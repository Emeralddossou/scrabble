import { NextRequest } from 'next/server';
import { z } from 'zod';

import { resetPassword } from '@/server/auth';
import { assertMutationOrigin, body, failure, success } from '@/server/http';
import { consumeRateLimit } from '@/server/security/rate-limit';

export const runtime = 'nodejs';

const input = z.object({ token: z.string().min(20).max(200), password: z.string().min(1) });

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const value = await body(request, input);
    await consumeRateLimit(`password-reset-confirm:${value.token.slice(0, 16)}`, 5, 60 * 60);
    await resetPassword(value.token, value.password);
    return success({ changed: true }, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
