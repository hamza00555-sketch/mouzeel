'use client';

import { useRef } from 'react';
import { CloseIcon } from '@/components/icons';
import { Field, PanelSection, Segmented, Slider, Toggle } from '@/components/ui/controls';
import type { BackgroundSettings, EdgeSettings, ShadowSettings } from '@/lib/bg/compose';
import type { ExportSettings } from '@/lib/bg/export';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { BrushState } from './CanvasStage';

const SWATCHES = [
  '#ffffff',
  '#000000',
  '#f4f4f5',
  '#1f2937',
  '#fee2e2',
  '#dbeafe',
  '#dcfce7',
  '#fef3c7',
  '#ede9fe',
  '#0ea5e9',
];

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function BackgroundPanel({
  dict,
  background,
  shadow,
  onBackground,
  onShadow,
}: {
  dict: Dictionary;
  background: BackgroundSettings;
  shadow: ShadowSettings;
  onBackground: (value: BackgroundSettings) => void;
  onShadow: (value: ShadowSettings) => void;
}) {
  const t = dict.editor.background;
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickImage(file: File | undefined) {
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    onBackground({ kind: 'image', bitmap });
  }

  return (
    <div className="space-y-6">
      <PanelSection title={t.title}>
        <Segmented
          label={t.title}
          value={background.kind}
          onChange={(kind) => {
            if (kind === 'transparent') return onBackground({ kind: 'transparent' });
            if (kind === 'color') return onBackground({ kind: 'color', color: '#ffffff' });
            if (kind === 'gradient')
              return onBackground({ kind: 'gradient', from: '#4f7dfb', to: '#47e0c4', angle: 45 });
            fileRef.current?.click();
          }}
          options={[
            { value: 'transparent', label: t.transparent },
            { value: 'color', label: t.color },
            { value: 'gradient', label: t.gradient },
            { value: 'image', label: t.image },
          ]}
        />

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            void pickImage(event.target.files?.[0]);
            event.target.value = '';
          }}
        />

        {background.kind === 'color' ? (
          <Field label={t.pickColor}>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  onClick={() => onBackground({ kind: 'color', color })}
                  style={{ background: color }}
                  className={`size-7 rounded-lg border transition ${
                    background.color === color
                      ? 'border-brand-400 ring-2 ring-brand-400/40'
                      : 'border-ink-600 hover:border-ink-400'
                  }`}
                />
              ))}
              <label className="flex size-7 cursor-pointer items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-ink-300 hover:border-ink-400">
                <span aria-hidden className="text-xs">
                  +
                </span>
                <input
                  type="color"
                  className="sr-only"
                  value={background.color}
                  onChange={(event) => onBackground({ kind: 'color', color: event.target.value })}
                />
              </label>
            </div>
          </Field>
        ) : null}

        {background.kind === 'gradient' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label={`${t.gradient} 1`}
                value={background.from}
                onChange={(event) => onBackground({ ...background, from: event.target.value })}
                className="h-9 w-full cursor-pointer rounded-lg border border-ink-700 bg-ink-850"
              />
              <input
                type="color"
                aria-label={`${t.gradient} 2`}
                value={background.to}
                onChange={(event) => onBackground({ ...background, to: event.target.value })}
                className="h-9 w-full cursor-pointer rounded-lg border border-ink-700 bg-ink-850"
              />
            </div>
            <Slider
              label="°"
              min={0}
              max={360}
              value={background.angle}
              onChange={(angle) => onBackground({ ...background, angle })}
            />
          </div>
        ) : null}

        {background.kind === 'image' ? (
          <button
            type="button"
            onClick={() => onBackground({ kind: 'transparent' })}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-700 py-2 text-sm text-ink-300 hover:bg-ink-800"
          >
            <CloseIcon className="size-4" />
            {t.removeImage}
          </button>
        ) : null}
      </PanelSection>

      <PanelSection title={t.shadow}>
        <Toggle
          label={t.shadow}
          hint={t.shadowHint}
          checked={shadow.enabled}
          onChange={(enabled) => onShadow({ ...shadow, enabled })}
        />

        {shadow.enabled ? (
          <div className="space-y-4 border-s-2 border-ink-800 ps-4">
            <Slider
              label={t.shadowBlur}
              min={0}
              max={80}
              value={shadow.blur}
              onChange={(blur) => onShadow({ ...shadow, blur })}
            />
            <Slider
              label={t.shadowOpacity}
              min={0}
              max={1}
              step={0.05}
              format={percent}
              value={shadow.opacity}
              onChange={(opacity) => onShadow({ ...shadow, opacity })}
            />
            <Slider
              label={t.shadowOffset}
              min={-80}
              max={80}
              value={shadow.offsetY}
              onChange={(offsetY) => onShadow({ ...shadow, offsetY })}
            />
          </div>
        ) : null}
      </PanelSection>
    </div>
  );
}

export function BrushPanel({
  dict,
  brush,
  onBrush,
}: {
  dict: Dictionary;
  brush: BrushState;
  onBrush: (value: BrushState) => void;
}) {
  const t = dict.editor.brush;

  return (
    <PanelSection title={t.title}>
      <p className="text-xs leading-relaxed text-ink-400">{t.hint}</p>

      <Segmented
        label={t.title}
        value={brush.active ? brush.mode : 'off'}
        onChange={(value) =>
          value === 'off'
            ? onBrush({ ...brush, active: false })
            : onBrush({ ...brush, active: true, mode: value as BrushState['mode'] })
        }
        options={[
          { value: 'off', label: '—', title: dict.editor.fit },
          { value: 'restore', label: t.restore },
          { value: 'erase', label: t.erase },
        ]}
      />

      <Slider
        label={t.size}
        min={4}
        max={200}
        value={brush.size}
        format={(value) => `${value}px`}
        onChange={(size) => onBrush({ ...brush, size })}
      />
      <Slider
        label={t.hardness}
        min={0}
        max={1}
        step={0.05}
        format={percent}
        value={brush.hardness}
        onChange={(hardness) => onBrush({ ...brush, hardness })}
      />
    </PanelSection>
  );
}

export function EdgePanel({
  dict,
  edges,
  onEdges,
}: {
  dict: Dictionary;
  edges: EdgeSettings;
  onEdges: (value: EdgeSettings) => void;
}) {
  const t = dict.editor.edges;

  return (
    <PanelSection title={t.title}>
      <p className="text-xs leading-relaxed text-ink-400">{t.hint}</p>

      <Slider
        label={t.feather}
        min={0}
        max={6}
        step={0.25}
        value={edges.feather}
        format={(value) => `${value}px`}
        onChange={(feather) => onEdges({ ...edges, feather })}
      />
      <Slider
        label={t.shrink}
        min={-1}
        max={1}
        step={0.05}
        value={edges.shrink}
        format={(value) => (value > 0 ? `+${percent(value)}` : percent(value))}
        onChange={(shrink) => onEdges({ ...edges, shrink })}
      />
      <Slider
        label={t.threshold}
        min={0}
        max={1}
        step={0.05}
        format={percent}
        value={edges.threshold}
        onChange={(threshold) => onEdges({ ...edges, threshold })}
      />
    </PanelSection>
  );
}

export function ExportPanel({
  dict,
  settings,
  onSettings,
  dimensions,
}: {
  dict: Dictionary;
  settings: ExportSettings;
  onSettings: (value: ExportSettings) => void;
  dimensions: { width: number; height: number };
}) {
  const t = dict.editor.export;

  return (
    <PanelSection title={t.title}>
      <Segmented
        label={t.format}
        value={settings.format}
        onChange={(format) => onSettings({ ...settings, format })}
        options={[
          { value: 'png', label: 'PNG', title: t.png },
          { value: 'webp', label: 'WEBP', title: t.webp },
          { value: 'jpeg', label: 'JPG', title: t.jpg },
        ]}
      />

      {settings.format === 'jpeg' ? (
        <p className="text-xs leading-relaxed text-amber-300/80">{t.jpgNote}</p>
      ) : null}

      {settings.format !== 'png' ? (
        <Slider
          label={t.quality}
          min={0.4}
          max={1}
          step={0.02}
          format={percent}
          value={settings.quality}
          onChange={(quality) => onSettings({ ...settings, quality })}
        />
      ) : null}

      <Toggle
        label={t.trim}
        hint={t.trimHint}
        checked={settings.trim}
        onChange={(trim) => onSettings({ ...settings, trim })}
      />

      {settings.trim ? (
        <div className="border-s-2 border-ink-800 ps-4">
          <Slider
            label={t.padding}
            min={0}
            max={0.3}
            step={0.01}
            format={percent}
            value={settings.padding}
            onChange={(padding) => onSettings({ ...settings, padding })}
          />
        </div>
      ) : null}

      <div className="flex items-baseline justify-between rounded-xl bg-ink-850 px-3 py-2.5 text-sm">
        <span className="text-ink-400">{t.dimensions}</span>
        <span dir="ltr" className="font-mono text-xs tabular-nums text-ink-200">
          {dimensions.width} × {dimensions.height}
        </span>
      </div>
    </PanelSection>
  );
}
