'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { heroAfter, heroBefore } from '@/lib/samples';

/**
 * The hero *is* the product demo: drag across the portrait and the background
 * peels away to the cutout underneath. Both frames are the same photograph, and
 * the transparent one was produced by this app's own BiRefNet pipeline — so what
 * the visitor is looking at is literally the output, not an illustration of it.
 */
export function HeroReveal({ hint }: { hint: string }) {
  const [split, setSplit] = useState(0.52);
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  // One unprompted sweep on arrival tells the visitor the handle is draggable
  // without a tooltip. Honours reduced motion by simply not running.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    const start = performance.now();
    const DURATION = 1900;
    const DELAY = 550;

    const tick = (now: number) => {
      const t = (now - start - DELAY) / DURATION;

      if (t >= 1) {
        setSplit(0.52);
        return;
      }

      if (t > 0) {
        // Out-and-back sweep, eased so it decelerates like hardware.
        const eased = 1 - Math.pow(1 - t, 3);
        setSplit(0.52 + Math.sin(eased * Math.PI) * 0.4);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const moveTo = useCallback((clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;

    const rect = frame.getBoundingClientRect();
    setSplit(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)));
  }, []);

  const onPointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    moveTo(event.clientX);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    if (event.key === 'ArrowLeft') setSplit((v) => Math.max(0, v - step));
    else if (event.key === 'ArrowRight') setSplit((v) => Math.min(1, v + step));
    else return;

    event.preventDefault();
  };

  const percent = split * 100;

  // Sized by viewport height, not width: the hero shares the screen with the
  // headline, and a width-constrained 3:4 frame pushes the type below the fold.
  return (
    <div
      ref={frameRef}
      onPointerDown={onPointerDown}
      onPointerMove={(event) => dragging && moveTo(event.clientX)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      className="relative mx-auto aspect-[3/4] h-[min(52svh,30rem)] max-w-full touch-none select-none rounded-sm focus-within:outline-2 focus-within:outline-offset-8 focus-within:outline-azure"
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
    >
      {/* Beneath: the cutout, sitting on the page's own black. */}
      <Image
        src={heroAfter}
        alt=""
        fill
        priority
        sizes="(max-width: 640px) 92vw, 34rem"
        className="object-contain"
      />

      {/* Above: the untouched photograph, clipped to the drag position. */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}
        aria-hidden
      >
        <Image
          src={heroBefore}
          alt=""
          fill
          priority
          sizes="(max-width: 640px) 92vw, 34rem"
          className="object-contain"
        />
      </div>

      {/*
        The seam. Positioned with physical `left`, not `inset-inline-start`:
        clip-path insets are physical too, and the drag maths is a physical
        left-to-right fraction — mixing in a logical property would send the
        handle to the opposite side of its own seam under RTL.
      */}
      <div
        className="pointer-events-none absolute inset-y-0 w-px bg-white/70"
        style={{ left: `${percent}%`, transform: 'translateX(-0.5px)' }}
        aria-hidden
      >
        <span
          className={`absolute top-1/2 size-11 -translate-y-1/2 rounded-full border border-white/40 bg-black/25 backdrop-blur-md transition-transform duration-500 ${dragging ? 'scale-95' : 'scale-100'}`}
          style={{ left: '-1.375rem' }}
        >
          <svg
            viewBox="0 0 24 24"
            className="absolute inset-0 m-auto size-4 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 6-5 6 5 6M15 6l5 6-5 6" />
          </svg>
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(percent)}
        aria-label={hint}
        onChange={(event) => {
          setSplit(Number(event.target.value) / 100);
        }}
        onKeyDown={onKeyDown}
        className="sr-only"
      />
    </div>
  );
}
