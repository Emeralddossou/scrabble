import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { gameAction, resolveGameUuid } from '@/server/game/service';
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
    const gameId = await resolveGameUuid((await context.params).id);
    return success(
      await gameAction({ gameId, userId: user.id, ...value }),
      requestId,
    );
  } catch (error) {
    return failure(error, requestId);
  }
}
