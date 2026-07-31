import { fal } from '@fal-ai/client';
import { NextResponse } from 'next/server';
import { MAX_FILE_BYTES } from '@/lib/bg/constants';
import { checkRateLimit, clientKey, hourlyLimit } from '@/lib/server/rate-limit';
import { detectImageType, verifyTurnstile } from '@/lib/server/validate';

export const runtime = 'nodejs';
export const maxDuration = 60;

function isConfigured() {
  return Boolean(process.env.FAL_KEY);
}

/** Lets the client know whether to offer the high-quality option at all. */
export function GET() {
  return NextResponse.json({
    available: isConfigured(),
    hourlyLimit,
    turnstile: Boolean(process.env.TURNSTILE_SECRET_KEY),
  });
}

export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: 'server_processing_disabled' }, { status: 503 });
  }

  const ip = clientKey(request);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'malformed_request' }, { status: 400 });
  }

  const image = form.get('image');
  if (!(image instanceof File)) {
    return NextResponse.json({ error: 'missing_image' }, { status: 400 });
  }

  if (image.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 413 });
  }

  const bytes = new Uint8Array(await image.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    return NextResponse.json({ error: 'unsupported_format' }, { status: 415 });
  }

  const token = form.get('turnstileToken');
  if (!(await verifyTurnstile(typeof token === 'string' ? token : null, ip))) {
    return NextResponse.json({ error: 'challenge_failed' }, { status: 403 });
  }

  // Checked after validation so malformed requests can't burn a user's quota.
  const { success, remaining } = await checkRateLimit(ip);
  if (!success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  try {
    fal.config({ credentials: process.env.FAL_KEY });

    const uploaded = await fal.storage.upload(new File([bytes as BlobPart], 'input', { type }));

    const { data } = await fal.subscribe('fal-ai/birefnet/v2', {
      input: {
        image_url: uploaded,
        model: 'General Use (Heavy)',
        operating_resolution: '2048x2048',
        refine_foreground: true,
        output_format: 'png',
      },
    });

    const url = (data as { image?: { url?: string } }).image?.url;
    if (!url) throw new Error('no image in fal response');

    const result = await fetch(url);
    if (!result.ok) throw new Error(`result fetch failed: ${result.status}`);

    return new NextResponse(await result.arrayBuffer(), {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'no-store',
        'x-remaining-quota': String(remaining),
      },
    });
  } catch (error) {
    console.error('[remove-background]', error);
    return NextResponse.json({ error: 'processing_failed' }, { status: 502 });
  }
}
