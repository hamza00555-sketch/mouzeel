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

export const ShieldIcon = (props: Props) => (
  <svg {...base} {...props}>
    <path d="M12 3 5 6v6c0 4.2 2.9 7.7 7 9 4.1-1.3 7-4.8 7-9V6l-7-3Z" />
    <path d="m9.5 12 1.8 1.8L15 10" />
  </svg>
);

export const SparkIcon = (props: Props) => (
  <svg {...base} {...props}>
    <path d="M12 3v4m0 10v4m9-9h-4M7 12H3m14.2-5.2-2.8 2.8M9.6 14.4l-2.8 2.8m10.4 0-2.8-2.8M9.6 9.6 6.8 6.8" />
  </svg>
);

export const BrushIcon = (props: Props) => (
  <svg {...base} {...props}>
    <path d="M15.5 4.5a2.1 2.1 0 0 1 3 3L11 15l-4 1 1-4 7.5-7.5Z" />
    <path d="M6 17c-1.2.6-1.5 2-1.5 3 1.5 0 2.6-.5 3.2-1.6" />
  </svg>
);

export const LayersIcon = (props: Props) => (
  <svg {...base} {...props}>
    <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
    <path d="m4 12 8 4.5 8-4.5M4 16.5 12 21l8-4.5" />
  </svg>
);

export const ScissorsIcon = (props: Props) => (
  <svg {...base} {...props}>
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="6" cy="18" r="2.4" />
    <path d="M8 7.6 19 18M8 16.4 19 6" />
  </svg>
);

export const ExpandIcon = (props: Props) => (
  <svg {...base} {...props}>
    <path d="M9 3H4a1 1 0 0 0-1 1v5m12-6h5a1 1 0 0 1 1 1v5M9 21H4a1 1 0 0 1-1-1v-5m12 6h5a1 1 0 0 0 1-1v-5" />
    <rect x="8" y="8" width="8" height="8" rx="1" />
  </svg>
);

export const OfflineIcon = (props: Props) => (
  <svg {...base} {...props}>
    <path d="M5 18h11a4 4 0 0 0 .8-7.9A6 6 0 0 0 5.6 8.6 3.7 3.7 0 0 0 5 18Z" />
    <path d="m3 3 18 18" />
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

export const AlertIcon = (props: Props) => (
  <svg {...base} {...props}>
    <path d="M12 4 3 19h18L12 4Z" />
    <path d="M12 10v4m0 3h.01" />
  </svg>
);
