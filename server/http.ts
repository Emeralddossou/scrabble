import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { AppError } from '@/server/security/errors';

export function assertMutationOrigin(request: NextRequest): void {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const expected = new URL(process.env.APP_URL ?? request.nextUrl.origin).origin;
  if (origin !== expected)
    throw new AppError('CSRF_ORIGIN_REJECTED', 403, 'Origine de la requête refusée.');
}

export function success(
  data: unknown,
  requestId: string = randomUUID(),
  status = 200,
): NextResponse {
  return NextResponse.json(
    { ok: true, data, requestId },
    { status, headers: { 'X-Request-Id': requestId } },
  );
}

export function failure(error: unknown, requestId: string = randomUUID()): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Données invalides.' }, requestId },
      { status: 422 },
    );
  }
  if (error instanceof AppError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message }, requestId },
      { status: error.status },
    );
  }
  console.error({ requestId, error });
  return NextResponse.json(
    {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue.' },
      requestId,
    },
    { status: 500 },
  );
}

export async function body<T>(
  request: NextRequest,
  parser: { parse(value: unknown): T },
): Promise<T> {
  return parser.parse(await request.json());
}
