'use client';

import { useEffect, useRef } from 'react';
import type { ElementType, ReactNode } from 'react';

/**
 * Scroll-in reveal that degrades to plain visible content.
 *
 * The element ships visible. The `reveal-armed` class — which is what actually
 * hides it — is added by JS only after we know an observer is running, and only
 * when the user hasn't asked for reduced motion. A headless renderer, a crawler,
 * or a browser with JS off therefore sees the content, never a blank section.
 */
export function Reveal({
  as: Tag = 'div',
  delay = 0,
  className = '',
  children,
}: {
  as?: ElementType;
  /** Milliseconds, for staggering siblings. */
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    // Already on screen at mount: leave it alone rather than hide then re-show.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) return;

    node.classList.add('reveal-armed');

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        node.style.transitionDelay = `${delay}ms`;
        node.classList.add('reveal-in');
        observer.disconnect();
      },
      { rootMargin: '0px 0px -12% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <Tag ref={ref} className={`reveal ${className}`}>
      {children}
    </Tag>
  );
}
