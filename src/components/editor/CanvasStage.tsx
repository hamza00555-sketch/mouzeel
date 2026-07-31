'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CompareIcon, FitIcon, MinusIcon, PlusIcon } from '@/components/icons';
import { render } from '@/lib/bg/compose';
import type { BackgroundSettings, ShadowSettings } from '@/lib/bg/compose';
import { PREVIEW_MAX_EDGE } from '@/lib/bg/constants';
import { scaledSize } from '@/lib/bg/image';
import type { Dictionary } from '@/lib/i18n/dictionaries';

export type BrushState = {
  active: boolean;
  mode: 'restore' | 'erase';
  size: number;
  hardness: number;
};

type Props = {
  dict: Dictionary;
  source: ImageBitmap;
  matte: HTMLCanvasElement;
  width: number;
  height: number;
  background: BackgroundSettings;
  shadow: ShadowSettings;
  brush: BrushState;
  /** Stroke coordinates are 0..1 of the image, so the caller can scale to the mask. */
  onStrokeStart: () => void;
  onStroke: (from: { x: number; y: number }, to: { x: number; y: number }) => void;
  onStrokeEnd: () => void;
  /** Bumped by the parent whenever the matte contents change. */
  revision: number;
};

export function CanvasStage({
  dict,
  source,
  matte,
  width,
  height,
  background,
  shadow,
  brush,
  onStrokeStart,
  onStroke,
  onStrokeEnd,
  revision,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [comparing, setComparing] = useState(false);

  const preview = scaledSize(width, height, PREVIEW_MAX_EDGE);

  // Redraw whenever anything visible changes. The heavy lifting is canvas
  // compositing, so this stays cheap enough to run synchronously.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = preview.width;
    canvas.height = preview.height;

    const context = canvas.getContext('2d');
    if (!context) return;

    if (comparing) {
      context.clearRect(0, 0, preview.width, preview.height);
      context.drawImage(source, 0, 0, preview.width, preview.height);
      return;
    }

    render(context, preview.width, preview.height, { source, matte, background, shadow });
  }, [source, matte, background, shadow, preview.width, preview.height, comparing, revision]);

  const pointToImage = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }, []);

  const painting = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const panning = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);

    if (!brush.active || event.button === 1) {
      panning.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
      return;
    }

    painting.current = true;
    last.current = pointToImage(event);
    onStrokeStart();
    onStroke(last.current, last.current);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (panning.current) {
      setOffset({ x: event.clientX - panning.current.x, y: event.clientY - panning.current.y });
      return;
    }

    if (!painting.current || !last.current) return;

    const point = pointToImage(event);
    onStroke(last.current, point);
    last.current = point;
  };

  const endStroke = () => {
    panning.current = null;
    if (!painting.current) return;

    painting.current = false;
    last.current = null;
    onStrokeEnd();
  };

  // A new image remounts the editor, so the view starts fitted without an effect.
  const fit = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={wrapperRef}
        className="checkerboard relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-xl2 border border-ink-800"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          onPointerCancel={endStroke}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            cursor: brush.active ? 'crosshair' : 'grab',
            touchAction: 'none',
          }}
          className="max-h-full max-w-full object-contain transition-transform duration-75"
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-ink-700 bg-ink-900/90 p-1 backdrop-blur">
          <StageButton title={dict.editor.zoomOut} onClick={() => setZoom((z) => Math.max(0.2, z - 0.25))}>
            <MinusIcon className="size-4" />
          </StageButton>
          <span className="w-12 text-center font-mono text-xs tabular-nums text-ink-300">
            {Math.round(zoom * 100)}%
          </span>
          <StageButton title={dict.editor.zoomIn} onClick={() => setZoom((z) => Math.min(8, z + 0.25))}>
            <PlusIcon className="size-4" />
          </StageButton>
          <StageButton title={dict.editor.fit} onClick={fit}>
            <FitIcon className="size-4" />
          </StageButton>

          <span className="mx-1 h-5 w-px bg-ink-700" />

          <StageButton
            title={dict.editor.compare}
            active={comparing}
            onPointerDown={() => setComparing(true)}
            onPointerUp={() => setComparing(false)}
            onPointerLeave={() => setComparing(false)}
          >
            <CompareIcon className="size-4" />
          </StageButton>
        </div>
      </div>
    </div>
  );
}

function StageButton({
  title,
  active,
  children,
  ...handlers
}: {
  title: string;
  active?: boolean;
  children: React.ReactNode;
} & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`flex size-8 items-center justify-center rounded-full transition ${
        active ? 'bg-brand-500 text-white' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-50'
      }`}
      {...handlers}
    >
      {children}
    </button>
  );
}
