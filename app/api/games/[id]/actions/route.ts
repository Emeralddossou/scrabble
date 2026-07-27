import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { gameAction } from '@/server/game/service';
import { assertMutationOrigin, body, failure, success } from '@/server/http';

export const runtime = 'nodejs';
const input = z.object({
  expectedVersion: z.number().int().positive(),
  actionId: z.string().uuid(),
  kind: z.enum(['pass', 'exchange', 'resign']),
  tileIds: z.array(z.string().uuid()).max(7).default([]),
});
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const user = await requireUser();
    const value = await body(request, input);
    return success(
      await gameAction({ gameId: Number((await context.params).id), userId: user.id, ...value }),
      requestId,
    );
  } catch (error) {
    return failure(error, requestId);
  }
}
