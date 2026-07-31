'use client';

import { useCallback, useEffect, useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { Editor } from '@/components/editor/Editor';
import {
  AlertIcon,
  BrushIcon,
  ExpandIcon,
  OfflineIcon,
  ShieldIcon,
  SparkIcon,
} from '@/components/icons';
import { isModelCached, supportsWebGPU } from '@/lib/bg/local-engine';
import { removeBackground, warmLocalEngine } from '@/lib/bg/remove';
import { MuzeelError } from '@/lib/bg/types';
import type { Cutout, ErrorCode, Progress } from '@/lib/bg/types';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/** Parallel to `dict.features.items`. */
const FEATURE_ICONS = [ShieldIcon, ExpandIcon, BrushIcon, OfflineIcon];

type State =
  | { status: 'idle' }
  | { status: 'working'; progress: Progress }
  | { status: 'ready'; cutout: Cutout }
  | { status: 'error'; code: ErrorCode };

export function Studio({ dict }: { dict: Dictionary }) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [fileName, setFileName] = useState('image');
  const [localReady, setLocalReady] = useState(false);
  const [warmup, setWarmup] = useState<Progress | null>(null);
  // Kept so the retry button can re-run the exact file that failed.
  const [lastFile, setLastFile] = useState<File | null>(null);
  /** Bumped per processed image so the editor remounts with fresh view state. */
  const [imageKey, setImageKey] = useState(0);

  useEffect(() => {
    void isModelCached().then(setLocalReady);
  }, []);

  const process = useCallback(async (file: File) => {
    setLastFile(file);
    setImageKey((value) => value + 1);
    setFileName(file.name);
    setState({ status: 'working', progress: { phase: 'reading', ratio: null } });

    try {
      const cutout = await removeBackground(file, {
        onProgress: (progress) => setState({ status: 'working', progress }),
      });
      setState({ status: 'ready', cutout });
    } catch (error) {
      setState({
        status: 'error',
        code: error instanceof MuzeelError ? error.code : 'unknown',
      });
    }
  }, []);

  /**
   * Warm the on-device engine once the user is looking at a result rather than a
   * spinner. The 114 MB download then lands invisibly, and every later image is
   * processed locally.
   */
  useEffect(() => {
    if (state.status !== 'ready' || localReady) return;

    let cancelled = false;

    void supportsWebGPU().then((ok) => {
      if (!ok || cancelled) return;

      return warmLocalEngine((progress) => {
        if (!cancelled && progress.phase === 'downloading') setWarmup(progress);
      }).then((warmed) => {
        if (cancelled) return;
        setWarmup(null);
        setLocalReady(warmed);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [state.status, localReady]);

  const reset = useCallback(() => {
    if (state.status === 'ready') {
      state.cutout.source.close();
      state.cutout.mask.close();
    }
    setState({ status: 'idle' });
  }, [state]);

  if (state.status === 'ready') {
    return (
      <main className="mx-auto flex min-h-0 w-full max-w-[1700px] flex-1 flex-col gap-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            tone={state.cutout.processedBy === 'local' ? 'good' : 'info'}
            icon={state.cutout.processedBy === 'local' ? <ShieldIcon className="size-3.5" /> : <SparkIcon className="size-3.5" />}
          >
            {state.cutout.processedBy === 'local' ? dict.engine.localBadge : dict.engine.serverBadge}
          </Badge>

          {warmup ? (
            <Badge tone="muted">
              {dict.engine.downloading} · {Math.round((warmup.ratio ?? 0) * 100)}%
            </Badge>
          ) : null}

          {localReady && state.cutout.processedBy === 'server' && !warmup ? (
            <Badge tone="muted">{dict.engine.localReady}</Badge>
          ) : null}
        </div>

        <Editor
          key={imageKey}
          dict={dict}
          cutout={state.cutout}
          fileName={fileName}
          onReset={reset}
        />
      </main>
    );
  }

  return (
    <main className="relative flex-1 overflow-y-auto">
      <div className="aurora relative mx-auto flex w-full max-w-6xl flex-col px-4 pb-16 pt-10 sm:pt-14">
        <section className="relative z-10 mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-900/70 px-3 py-1 text-xs text-ink-300">
            <ShieldIcon className="size-3.5 text-accent-400" />
            {dict.hero.badge}
          </span>

          <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.15] tracking-tight text-ink-50 sm:text-5xl">
            {dict.hero.title}{' '}
            <span className="bg-gradient-to-l from-brand-400 to-accent-400 bg-clip-text text-transparent">
              {dict.hero.titleAccent}
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-ink-300">
            {dict.hero.subtitle}
          </p>
        </section>

        <div className="relative z-10 mx-auto mt-10 w-full max-w-4xl">
          {state.status === 'working' ? <Working dict={dict} progress={state.progress} /> : null}
          {state.status === 'error' ? <ErrorCard /> : null}
          {state.status === 'idle' ? (
            <Dropzone dict={dict} onSelect={(file) => void process(file)} />
          ) : null}
        </div>

        <section className="relative z-10 mt-20">
          <h2 className="text-center text-xl font-semibold text-ink-50">{dict.features.title}</h2>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {dict.features.items.map((item, index) => {
              const Icon = FEATURE_ICONS[index];
              return (
                <li key={item.title} className="rounded-xl2 border border-ink-800 bg-ink-900/50 p-5">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-ink-800 text-brand-400">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-ink-50">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{item.body}</p>
                </li>
              );
            })}
          </ul>

          <div className="mt-14 flex flex-col items-center gap-1.5 border-t border-ink-800/80 pt-8 text-center text-xs text-ink-400">
            <p>{dict.footer.privacy}</p>
            <p>{dict.footer.builtWith}</p>
          </div>
        </section>
      </div>
    </main>
  );

  function ErrorCard() {
    if (state.status !== 'error') return null;

    return (
      <div className="rounded-xl2 border border-red-500/30 bg-red-500/5 p-6 text-center sm:p-10">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
          <AlertIcon className="size-6" />
        </span>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink-200">
          {dict.errors[state.code]}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          {lastFile ? (
            <button
              type="button"
              onClick={() => void process(lastFile)}
              className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              {dict.errors.retry}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setState({ status: 'idle' })}
            className="rounded-xl border border-ink-700 px-4 py-2 text-sm text-ink-200 hover:bg-ink-800"
          >
            {dict.errors.dismiss}
          </button>
        </div>
      </div>
    );
  }
}

function Working({ dict, progress }: { dict: Dictionary; progress: Progress }) {
  const label =
    progress.phase === 'downloading'
      ? dict.engine.downloading
      : progress.phase === 'loading'
        ? dict.engine.loading
        : progress.phase === 'reading'
          ? dict.engine.reading
          : progress.phase === 'refining'
            ? dict.engine.refining
            : dict.engine.processing;

  const ratio = progress.ratio;

  return (
    <div className="rounded-xl2 border border-ink-800 bg-ink-900/60 p-8 text-center sm:p-14">
      <div className="mx-auto max-w-sm space-y-5">
        <p className="text-base font-medium text-ink-50">{label}</p>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={ratio === null ? undefined : Math.round(ratio * 100)}
          aria-label={label}
          className="h-1.5 overflow-hidden rounded-full bg-ink-800"
        >
          <div
            className={`h-full rounded-full bg-brand-500 ${
              ratio === null ? 'w-1/3 animate-pulse' : 'transition-[width] duration-200'
            }`}
            style={ratio === null ? undefined : { width: `${Math.round(ratio * 100)}%` }}
          />
        </div>

        {progress.phase === 'downloading' ? (
          <p className="text-xs leading-relaxed text-ink-400">{dict.engine.preparingHint}</p>
        ) : null}
      </div>
    </div>
  );
}

function Badge({
  children,
  tone = 'muted',
  icon,
}: {
  children: React.ReactNode;
  tone?: 'good' | 'info' | 'muted';
  icon?: React.ReactNode;
}) {
  const tones = {
    good: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    info: 'border-brand-500/25 bg-brand-500/10 text-brand-400',
    muted: 'border-ink-700 bg-ink-850 text-ink-300',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}
