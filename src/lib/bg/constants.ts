/**
 * BiRefNet_lite, exported to ONNX with fp16 weights but fp32 graph I/O.
 * MIT licensed — unlike BRIA's RMBG family, which is CC BY-NC and cannot be
 * used commercially. Do not swap this for RMBG without buying a license.
 *
 * Verified signature:
 *   input   input_image  float32 [1, 3, 1024, 1024]  ImageNet-normalised RGB
 *   output  output_image float32 [1, 1, 1024, 1024]  raw logits — needs sigmoid
 */
export const MODEL_URL =
  process.env.NEXT_PUBLIC_MODEL_URL ??
  'https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model_fp16.onnx';

export const MODEL_BYTES = 114_538_221;
export const MODEL_CACHE = 'muzeel-model-v1';

export const INPUT_NAME = 'input_image';
export const OUTPUT_NAME = 'output_image';
export const INPUT_SIZE = 1024;

export const IMAGENET_MEAN = [0.485, 0.456, 0.406] as const;
export const IMAGENET_STD = [0.229, 0.224, 0.225] as const;

/** Matches the server route's own limits so the client fails fast and in Arabic. */
export const MAX_FILE_BYTES = 30 * 1024 * 1024;
export const MAX_PIXELS = 30_000_000;
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/**
 * The mask never carries more than 1024px of real model detail, so storing it at
 * full resolution buys nothing but memory pressure — a 30MP image would need a
 * 120MB canvas. We cap it here and upscale at export instead; brush strokes stay
 * comfortably precise at this size.
 */
export const MASK_MAX_EDGE = 2048;

/** Long edge of the interactive preview. Export always renders at full size. */
export const PREVIEW_MAX_EDGE = 2048;
