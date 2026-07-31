import type { SVGProps } from 'react';

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
} as const;

type Props = SVGProps<SVGSVGElement>;

export const UploadIcon = (props: Props) => (
  <svg {...base} {...props}>
    <path d="M12 16V4m0 0L8 8m4-4 4 4" />
    <path d="M20 15v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3" />
  </svg>
);

export const DownloadIcon = (props: Props) => (
  <svg {...base} {...props}>
    <path d="M12 4v12m0 0 4-4m-4 4-4-4" />
    <path d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
  </svg>
);

export const UndoIcon = (props: Props) => (
  <svg {...base} {...props}>
    <path d="M4 9h10a5 5 0 0 1 0 10h-3" />
    <path d="M4 9l4-4M4 9l4 4" />
  </svg>
);

export const RedoIcon = (props: Props) => (
  <svg {...base} {...props}>
    <path d="M20 9H10a5 5 0 0 0 0 10h3" />
    <path d="m20 9-4-4m4 4-4 4" />
  </svg>
);

export const CloseIcon = (props: Props) => (
  <svg {...base} {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const PlusIcon = (props: Props) => (
  <svg {...base} {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const MinusIcon = (props: Props) => (
  <svg {...base} {...props}>
    <path d="M5 12h14" />
  </svg>
);

export const FitIcon = (props: Props) => (
  <svg {...base} {...props}>
    <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
  </svg>
);

export const CompareIcon = (props: Props) => (
  <svg {...base} {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M12 5v14" />
  </svg>
);
