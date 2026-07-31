'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ACCEPTED_TYPES } from '@/lib/bg/constants';
import type { Dictionary } from '@/lib/i18n/dictionaries';

const accept = ACCEPTED_TYPES.join(',');

export function Dropzone({
  dict,
  onSelect,
}: {
  dict: Dictionary;
  onSelect: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onSelect(file);
    },
    [onSelect],
  );

  // Ctrl+V anywhere on the page — the fastest path from a screenshot to a cutout.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const file = Array.from(event.clipboardData?.files ?? [])[0];
      if (file?.type.startsWith('image/')) {
        event.preventDefault();
        onSelect(file);
      }
    }

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onSelect]);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={`rounded-[1.75rem] px-6 py-14 text-center transition-colors duration-300 sm:py-20 ${
        dragging ? 'bg-azure/[0.07]' : 'bg-fog'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = ''; // let the same file be picked twice
        }}
      />

      <p className="text-[clamp(1.375rem,3.5vw,1.75rem)] font-semibold tracking-tight text-ink">
        {dict.dropzone.title}
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-6 rounded-full bg-azure px-7 py-3 text-[15px] font-medium text-white transition hover:bg-azure-lift active:scale-[0.98]"
      >
        {dict.dropzone.button}
      </button>

      <p className="mt-6 text-[13px] text-ink-soft">{dict.dropzone.formats}</p>
      <p className="mt-1 hidden text-[13px] text-ink-soft sm:block">{dict.dropzone.paste}</p>
    </div>
  );
}
