import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { playMove, resolveGameUuid } from '@/server/game/service';
import { assertMutationOrigin, body, failure, success } from '@/server/http';

export const runtime = 'nodejs';
const input = z.object({
  expectedVersion: z.number().int().positive(),
  actionId: z.string().uuid(),
  placements: z
    .array(
      z.object({
        row: z.number().int().min(0).max(14),
        col: z.number().int().min(0).max(14),
        tileId: z.string().uuid(),
        letter: z.string().length(1),
      }),
    )
    .min(1)
    .max(7),
});
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const user = await requireUser();
    const value = await body(request, input);
    const gameId = await resolveGameUuid((await context.params).id);
    return success(
      await playMove({ gameId, userId: user.id, ...value }),
      requestId,
    );
  } catch (error) {
    return failure(error, requestId);
  }
}
