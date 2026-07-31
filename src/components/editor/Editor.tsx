'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DownloadIcon, RedoIcon, UndoIcon, UploadIcon } from '@/components/icons';
import {
  defaultBackground,
  defaultEdges,
  defaultShadow,
  refineMask,
} from '@/lib/bg/compose';
import type { BackgroundSettings, EdgeSettings, ShadowSettings } from '@/lib/bg/compose';
import { MASK_MAX_EDGE } from '@/lib/bg/constants';
import { defaultExport, downloadBlob, exportImage, outputName } from '@/lib/bg/export';
import type { ExportSettings } from '@/lib/bg/export';
import { context2d, createCanvas, scaledSize } from '@/lib/bg/image';
import type { Cutout } from '@/lib/bg/types';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { CanvasStage } from './CanvasStage';
import type { BrushState } from './CanvasStage';
import { BackgroundPanel, BrushPanel, EdgePanel, ExportPanel } from './panels';

type Tab = 'background' | 'brush' | 'edges' | 'export';

const MAX_UNDO = 20;

/** Snapshot of the region a stroke touched, so undo doesn't copy the whole matte. */
type Snapshot = { x: number; y: number; data: ImageData };

export function Editor({
  dict,
  cutout,
  fileName,
  onReset,
}: {
  dict: Dictionary;
  cutout: Cutout;
  fileName: string;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<Tab>('background');
  const [edges, setEdges] = useState<EdgeSettings>(defaultEdges);
  const [background, setBackground] = useState<BackgroundSettings>(defaultBackground);
  const [shadow, setShadow] = useState<ShadowSettings>(defaultShadow);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(defaultExport);
  const [brush, setBrush] = useState<BrushState>({
    active: false,
    mode: 'restore',
    size: 40,
    hardness: 0.7,
  });
  const [busy, setBusy] = useState(false);

  // Working-resolution copy of the raw matte. Brush strokes mutate this canvas
  // directly; `revision` tells React that its pixels changed.
  const [revision, setRevision] = useState(0);
  const maskSize = useMemo(
    () => scaledSize(cutout.width, cutout.height, MASK_MAX_EDGE),
    [cutout.width, cutout.height],
  );

  const rawMask = useMemo(() => {
    const canvas = createCanvas(maskSize.width, maskSize.height);
    context2d(canvas).drawImage(cutout.mask, 0, 0, maskSize.width, maskSize.height);
    return canvas;
  }, [cutout.mask, maskSize.width, maskSize.height]);

  // Feather/levels are pure functions of the matte and the edge sliders, so they
  // only recompute when one of those actually changes — not on every repaint.
  const matte = useMemo(
    () => refineMask(rawMask, maskSize.width, maskSize.height, edges),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `revision` tracks in-place pixel writes
    [rawMask, maskSize.width, maskSize.height, edges, revision],
  );

  // The stacks hold full ImageData regions, so they live in refs to stay out of
  // render. Their depths are mirrored into state — that is what the buttons need.
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const syncHistory = useCallback(
    () => setHistory({ undo: undoStack.current.length, redo: redoStack.current.length }),
    [],
  );

  const strokeBounds = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(
    null,
  );

  const beginStroke = useCallback(() => {
    strokeBounds.current = null;
  }, []);

  const paint = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const context = context2d(rawMask);
      const radius = (brush.size / 2) * (maskSize.width / 1000);

      const x1 = from.x * maskSize.width;
      const y1 = from.y * maskSize.height;
      const x2 = to.x * maskSize.width;
      const y2 = to.y * maskSize.height;

      // Restore paints opaque alpha back in; erase carves it out.
      context.globalCompositeOperation =
        brush.mode === 'restore' ? 'source-over' : 'destination-out';

      const softness = 1 - brush.hardness;
      if (softness > 0.02) {
        const gradient = context.createRadialGradient(x2, y2, radius * brush.hardness, x2, y2, radius);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.strokeStyle = gradient;
        context.fillStyle = gradient;
      } else {
        context.strokeStyle = '#fff';
        context.fillStyle = '#fff';
      }

      context.lineWidth = radius * 2;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.stroke();
      context.globalCompositeOperation = 'source-over';

      // Grow the dirty region so the undo snapshot covers everything we touched.
      const pad = radius + 2;
      const previous = strokeBounds.current;
      strokeBounds.current = {
        minX: Math.min(previous?.minX ?? Infinity, x1 - pad, x2 - pad),
        minY: Math.min(previous?.minY ?? Infinity, y1 - pad, y2 - pad),
        maxX: Math.max(previous?.maxX ?? -Infinity, x1 + pad, x2 + pad),
        maxY: Math.max(previous?.maxY ?? -Infinity, y1 + pad, y2 + pad),
      };

      setRevision((value) => value + 1);
    },
    [brush.hardness, brush.mode, brush.size, maskSize.height, maskSize.width, rawMask],
  );

  /**
   * Snapshots are taken at stroke end rather than start: we capture the *result*
   * and rebuild the previous state by keeping the pre-stroke pixels, which we
   * still hold because the stroke bounds tell us exactly what to re-read.
   */
  const endStroke = useCallback(() => {
    const bounds = strokeBounds.current;
    strokeBounds.current = null;
    if (!bounds) return;

    const x = Math.max(0, Math.floor(bounds.minX));
    const y = Math.max(0, Math.floor(bounds.minY));
    const width = Math.min(maskSize.width - x, Math.ceil(bounds.maxX - x));
    const height = Math.min(maskSize.height - y, Math.ceil(bounds.maxY - y));
    if (width <= 0 || height <= 0) return;

    undoStack.current.push({ x, y, data: context2d(rawMask).getImageData(x, y, width, height) });
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
    syncHistory();
  }, [maskSize.height, maskSize.width, rawMask, syncHistory]);

  // Undo swaps the stored region with what is on the canvas now, which makes the
  // same snapshot serve as the redo entry.
  const swap = useCallback(
    (from: Snapshot[], to: Snapshot[]) => {
      const snapshot = from.pop();
      if (!snapshot) return;

      const context = context2d(rawMask);
      const { width, height } = snapshot.data;
      const current = context.getImageData(snapshot.x, snapshot.y, width, height);

      context.putImageData(snapshot.data, snapshot.x, snapshot.y);
      to.push({ x: snapshot.x, y: snapshot.y, data: current });

      setRevision((value) => value + 1);
      syncHistory();
    },
    [rawMask, syncHistory],
  );

  const undo = useCallback(() => swap(undoStack.current, redoStack.current), [swap]);
  const redo = useCallback(() => swap(redoStack.current, undoStack.current), [swap]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [redo, undo]);

  async function download() {
    setBusy(true);
    try {
      const blob = await exportImage({
        source: cutout.source,
        matte,
        width: cutout.width,
        height: cutout.height,
        background,
        shadow,
        settings: exportSettings,
      });
      downloadBlob(blob, outputName(fileName, exportSettings.format));
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'background', label: dict.editor.tabs.background },
    { id: 'brush', label: dict.editor.tabs.brush },
    { id: 'edges', label: dict.editor.tabs.edges },
    { id: 'export', label: dict.editor.tabs.export },
  ];

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex min-h-0 flex-col gap-3">
        <CanvasStage
          dict={dict}
          source={cutout.source}
          matte={matte}
          width={cutout.width}
          height={cutout.height}
          background={background}
          shadow={shadow}
          brush={brush}
          revision={revision}
          onStrokeStart={beginStroke}
          onStroke={paint}
          onStrokeEnd={endStroke}
        />
      </div>

      {/* Inspector. Surfaces separate by tone, not by outline — the only rule is
          the one under the toolbar, which has a real job. */}
      <aside className="flex min-h-0 flex-col rounded-[1.25rem] bg-shell">
        <div className="flex items-center justify-between gap-2 p-2.5">
          <div className="flex gap-0.5">
            <IconButton label={dict.editor.undo} disabled={history.undo === 0} onClick={undo}>
              <UndoIcon className="size-[18px]" />
            </IconButton>
            <IconButton label={dict.editor.redo} disabled={history.redo === 0} onClick={redo}>
              <RedoIcon className="size-[18px]" />
            </IconButton>
          </div>

          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-azure transition hover:bg-shell-high"
          >
            <UploadIcon className="size-3.5" />
            {dict.editor.newImage}
          </button>
        </div>

        {/* Segmented control, Apple's own: one recessed track, one raised pill. */}
        <div className="px-2.5 pb-3">
          <nav
            className="grid grid-cols-4 gap-0.5 rounded-[0.625rem] bg-void/40 p-0.5"
            role="tablist"
          >
            {tabs.map((entry) => (
              <button
                key={entry.id}
                role="tab"
                aria-selected={tab === entry.id}
                onClick={() => setTab(entry.id)}
                className={`rounded-lg px-1 py-1.5 text-[13px] font-medium transition duration-200 ease-hardware ${
                  tab === entry.id
                    ? 'bg-shell-high text-chalk shadow-sm'
                    : 'text-chalk-soft hover:text-chalk'
                }`}
              >
                {entry.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {tab === 'background' ? (
            <BackgroundPanel
              dict={dict}
              background={background}
              shadow={shadow}
              onBackground={setBackground}
              onShadow={setShadow}
            />
          ) : null}
          {tab === 'brush' ? <BrushPanel dict={dict} brush={brush} onBrush={setBrush} /> : null}
          {tab === 'edges' ? <EdgePanel dict={dict} edges={edges} onEdges={setEdges} /> : null}
          {tab === 'export' ? (
            <ExportPanel
              dict={dict}
              settings={exportSettings}
              onSettings={setExportSettings}
              dimensions={{ width: cutout.width, height: cutout.height }}
            />
          ) : null}
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={download}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-azure py-3 text-[15px] font-medium text-white transition duration-200 ease-hardware hover:bg-azure-lift active:scale-[0.98] disabled:opacity-50"
          >
            <DownloadIcon className="size-4" />
            {busy ? dict.editor.downloading : dict.editor.download}
          </button>
        </div>
      </aside>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-full text-chalk-soft transition hover:bg-shell-high hover:text-chalk disabled:pointer-events-none disabled:opacity-25"
    >
      {children}
    </button>
  );
}
