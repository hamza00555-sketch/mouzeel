'use client';

import Image from 'next/image';
import { useCallback, useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { Editor } from '@/components/editor/Editor';
import { HeroReveal } from '@/components/marketing/HeroReveal';
import { Reveal } from '@/components/marketing/Reveal';
import { removeBackground } from '@/lib/bg/remove';
import { MuzeelError } from '@/lib/bg/types';
import type { Cutout, ErrorCode, Progress } from '@/lib/bg/types';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { fetchSampleAsFile, samples } from '@/lib/samples';

type State =
  | { status: 'idle' }
  | { status: 'working'; progress: Progress }
  | { status: 'ready'; cutout: Cutout }
  | { status: 'error'; code: ErrorCode; detail?: string };

export function Studio({ dict }: { dict: Dictionary }) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [fileName, setFileName] = useState('image');
  const [lastFile, setLastFile] = useState<File | null>(null);
  /** Bumped per processed image so the editor remounts with fresh view state. */
  const [imageKey, setImageKey] = useState(0);


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
        detail:
          error instanceof MuzeelError
            ? error.detail
            : error instanceof Error
              ? error.message
              : undefined,
      });
    }
  }, []);

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

  const busy = state.status === 'working';

  return (
    <main className="flex-1 overflow-y-auto">
      {/*
        Hero: headline first, then the product. Apple never buries the line
        under the image, and the reveal is sized by viewport *height* so both
        always land above the fold on a laptop.
      */}
      <section className="flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center gap-8 px-6 py-12 sm:gap-10">
        <div className="max-w-3xl text-center">
          {/*
            Two lines, not one. Apple's clipped-sentence headline style puts a
            full stop mid-line, and in RTL that stop lands at the far left of
            the phrase before it — with a gap after, it reads as a typo rather
            than punctuation. Breaking the lines keeps each stop beside its own
            sentence.
          */}
          <h1 className="display text-[clamp(2.5rem,7.5vw,4.5rem)]">
            {dict.hero.title}
            <br />
            <span className="text-chalk-soft">{dict.hero.titleAccent}</span>
          </h1>
          <p className="lede mx-auto mt-4 text-[clamp(1rem,2.2vw,1.3125rem)] text-chalk-soft">
            {dict.hero.subtitle}
          </p>
        </div>

        <figure className="flex min-h-0 flex-col items-center">
          <HeroReveal hint={dict.hero.revealHint} />
          <figcaption className="mt-4 max-w-xs text-center text-[12px] leading-relaxed text-chalk-soft/80">
            {dict.hero.revealCaption}
          </figcaption>
        </figure>
      </section>

      {/* ── The tool itself, on white so it reads as the working surface ──── */}
      <section id="tool" className="scroll-mt-12 bg-canvas px-6 py-20 text-ink sm:py-28">
        <div className="mx-auto w-full max-w-3xl">
          {busy ? <Working dict={dict} progress={state.progress} /> : null}
          {state.status === 'error' ? <ErrorCard /> : null}
          {state.status === 'idle' ? (
            <>
              <Dropzone dict={dict} onSelect={(file) => void process(file)} />

              <div className="mt-10">
                <p className="text-center text-[15px] text-ink-soft">{dict.samples.title}</p>
                <ul className="mt-5 grid grid-cols-3 gap-3 sm:gap-5">
                  {samples.map((sample) => (
                    <li key={sample.id}>
                      <button
                        type="button"
                        onClick={() =>
                          void fetchSampleAsFile(sample).then(process).catch(() => {})
                        }
                        className="group block w-full text-start"
                      >
                        <span className="block overflow-hidden rounded-2xl bg-fog">
                          <Image
                            src={sample.src}
                            alt={dict.samples[sample.labelKey]}
                            width={1000}
                            height={1000}
                            sizes="(max-width: 640px) 30vw, 13rem"
                            className="aspect-square w-full object-cover transition-transform duration-700 ease-hardware group-hover:scale-[1.04]"
                          />
                        </span>
                        <span className="mt-2.5 block text-[13px] text-ink-soft transition-colors group-hover:text-ink">
                          {dict.samples[sample.labelKey]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </div>
      </section>

      {/* ── Three claims, each given its own full stage ───────────────────── */}
      <Showcase dict={dict} />

      <footer className="border-t border-white/10 px-6 py-10 text-center text-[13px] text-chalk-soft/70">
        <p>{dict.footer.privacy}</p>
        <p className="mt-1.5">{dict.footer.builtWith}</p>
      </footer>
    </main>
  );

  function ErrorCard() {
    if (state.status !== 'error') return null;

    return (
      <div role="alert" className="mx-auto max-w-lg py-6 text-center">
        <p className="text-[17px] leading-relaxed text-ink">{dict.errors[state.code]}</p>

        {/* The raw reason, tucked away. Without it a failed engine is a dead end
            the user can neither diagnose nor report. */}
        {state.detail ? (
          <details className="mt-4 text-start">
            <summary className="cursor-pointer text-center text-[13px] text-ink-soft transition-colors hover:text-ink">
              {dict.errors.details}
            </summary>
            <p
              dir="ltr"
              className="mt-3 max-h-40 overflow-auto rounded-xl bg-fog p-3 font-mono text-[11px] leading-relaxed break-words text-ink-soft"
            >
              {state.detail}
            </p>
          </details>
        ) : null}

        <div className="mt-7 flex justify-center gap-3">
          {lastFile ? (
            <button
              type="button"
              onClick={() => void process(lastFile)}
              className="rounded-full bg-azure px-6 py-2.5 text-[15px] font-medium text-white transition hover:bg-azure-lift"
            >
              {dict.errors.retry}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setState({ status: 'idle' })}
            className="rounded-full px-6 py-2.5 text-[15px] font-medium text-azure transition hover:bg-ink/5"
          >
            {dict.errors.dismiss}
          </button>
        </div>
      </div>
    );
  }
}

function Showcase({ dict }: { dict: Dictionary }) {
  const { showcase } = dict;

  return (
    <>
      {/* Privacy: black, quiet, no imagery — the claim is about absence. */}
      <section className="px-6 py-28 sm:py-40">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="display text-[clamp(2rem,6vw,3.75rem)]">{showcase.privacyTitle}</h2>
          <p className="lede mx-auto mt-6 text-[clamp(1rem,2.2vw,1.3125rem)] text-chalk-soft">
            {showcase.privacyBody}
          </p>
        </Reveal>
      </section>

      {/* Precision: the cutout again, huge, cropped into the hair. */}
      <section className="bg-canvas px-6 py-28 text-ink sm:py-40">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2 md:gap-20">
          <Reveal>
            <h2 className="display text-[clamp(2rem,5vw,3.5rem)]">{showcase.precisionTitle}</h2>
            <p className="lede mt-6 text-[clamp(1rem,2vw,1.25rem)] text-ink-soft">
              {showcase.precisionBody}
            </p>
          </Reveal>

          {/* Cropped into the head so the flying strands read at full size —
              the checkerboard behind them is what makes "transparent" legible. */}
          <Reveal delay={120} className="checkerboard aspect-square overflow-hidden rounded-[1.75rem]">
            <Image
              src="/media/hero-after.webp"
              alt=""
              width={1100}
              height={1467}
              sizes="(max-width: 768px) 88vw, 32rem"
              className="size-full object-cover object-[50%_14%]"
            />
          </Reveal>
        </div>
      </section>

      {/* Control: back to black, closing the alternation. */}
      <section className="px-6 py-28 sm:py-40">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="display text-[clamp(2rem,6vw,3.75rem)]">{showcase.controlTitle}</h2>
          <p className="lede mx-auto mt-6 text-[clamp(1rem,2.2vw,1.3125rem)] text-chalk-soft">
            {showcase.controlBody}
          </p>
        </Reveal>
      </section>
    </>
  );
}

function Working({ dict, progress }: { dict: Dictionary; progress: Progress }) {
  const label =
    progress.phase === 'reading'
      ? dict.engine.reading
      : progress.phase === 'refining'
        ? dict.engine.refining
        : dict.engine.processing;

  const ratio = progress.ratio;

  return (
    <div className="mx-auto max-w-sm py-14 text-center">
      <p className="text-[17px] font-medium text-ink">{label}</p>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={ratio === null ? undefined : Math.round(ratio * 100)}
        aria-label={label}
        className="mt-5 h-1 overflow-hidden rounded-full bg-ink/10"
      >
        <div
          className={`h-full rounded-full bg-azure ${
            ratio === null ? 'w-1/3 animate-pulse' : 'transition-[width] duration-300 ease-hardware'
          }`}
          style={ratio === null ? undefined : { width: `${Math.round(ratio * 100)}%` }}
        />
      </div>

    </div>
  );
}
