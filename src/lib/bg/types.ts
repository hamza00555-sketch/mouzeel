export type EnginePhase =
  | 'idle'
  | 'downloading'
  | 'loading'
  | 'reading'
  | 'processing'
  | 'refining'
  | 'done';

export type Progress = {
  phase: EnginePhase;
  /** 0..1, or null when the phase has no measurable length. */
  ratio: number | null;
};


export type ErrorCode =
  | 'tooLarge'
  | 'tooManyPixels'
  | 'badFormat'
  | 'corrupt'
  | 'serverFailed'
  | 'rateLimited'
  | 'unknown';

export class MuzeelError extends Error {
  constructor(
    readonly code: ErrorCode,
    cause?: unknown,
    /**
     * Raw underlying reason, shown behind a disclosure in the UI. Without it a
     * failed engine is undiagnosable for the user and unreportable to us.
     */
    readonly detail?: string,
  ) {
    super(code, { cause });
    this.name = 'MuzeelError';
  }
}

/** What the engine hands back: the untouched source plus a soft alpha matte. */
export type Cutout = {
  source: ImageBitmap;
  /** Alpha matte carried in the bitmap's alpha channel (RGB is white). */
  mask: ImageBitmap;
  width: number;
  height: number;
};

