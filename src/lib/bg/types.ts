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

export type ProcessingMode = 'auto' | 'local' | 'server';
export type ProcessedBy = 'local' | 'server';

export type ErrorCode =
  | 'tooLarge'
  | 'tooManyPixels'
  | 'badFormat'
  | 'corrupt'
  | 'noEngine'
  | 'engineFailed'
  | 'networkModel'
  | 'serverFailed'
  | 'rateLimited'
  | 'unknown';

export class MuzeelError extends Error {
  constructor(
    readonly code: ErrorCode,
    cause?: unknown,
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
  processedBy: ProcessedBy;
};

export type WorkerRequest =
  | { type: 'warmup' }
  | { type: 'run'; id: number; bitmap: ImageBitmap };

export type WorkerResponse =
  | { type: 'progress'; phase: EnginePhase; ratio: number | null }
  | { type: 'ready' }
  | { type: 'result'; id: number; mask: ImageBitmap }
  | { type: 'error'; id?: number; code: ErrorCode; message: string };
