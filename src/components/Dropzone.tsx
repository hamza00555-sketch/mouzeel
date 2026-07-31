'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { UploadIcon } from '@/components/icons';
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
      className={`group relative rounded-xl2 border-2 border-dashed p-8 text-center transition sm:p-12 ${
        dragging
          ? 'border-brand-400 bg-brand-500/10'
          : 'border-ink-700 bg-ink-900/60 hover:border-ink-600 hover:bg-ink-900'
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

      <div className="mx-auto flex max-w-md flex-col items-center gap-4">
        <span
          className={`flex size-14 items-center justify-center rounded-2xl transition ${
            dragging ? 'bg-brand-500 text-white' : 'bg-ink-800 text-brand-400'
          }`}
        >
          <UploadIcon className="size-7" />
        </span>

        <div className="space-y-1.5">
          <p className="text-lg font-semibold text-ink-50">{dict.dropzone.title}</p>
          <p className="text-sm text-ink-300">{dict.dropzone.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        >
          {dict.dropzone.button}
        </button>

        <div className="space-y-1 text-xs text-ink-400">
          <p>{dict.dropzone.formats}</p>
          <p className="hidden sm:block">{dict.dropzone.paste}</p>
        </div>
      </div>
    </div>
  );
}
