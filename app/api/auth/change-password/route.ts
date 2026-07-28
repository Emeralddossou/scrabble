import { NextRequest } from 'next/server';
import { z } from 'zod';

import { changePassword, requireUser } from '@/server/auth';
import { assertMutationOrigin, body, failure, success } from '@/server/http';
import { consumeRateLimit } from '@/server/security/rate-limit';

export const runtime = 'nodejs';

const input = z.object({
  currentPassword: z.string().min(1),
  nextPassword: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const user = await requireUser();
    await consumeRateLimit(`password-change:${user.id}`, 5, 60 * 60);
    const value = await body(request, input);
    await changePassword(user.id, value.currentPassword, value.nextPassword);
    return success({ changed: true, signInAgain: true }, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
