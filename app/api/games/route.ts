import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { createGame } from '@/server/game/service';
import { assertMutationOrigin, body, failure, success } from '@/server/http';

export const runtime = 'nodejs';
const input = z
  .object({
    opponentId: z.number().int().positive().optional(),
    mode: z.enum(['free', 'timer']),
    timeLimitMinutes: z.number().int().min(1).max(120),
    incrementSeconds: z.number().int().min(0).max(120),
    aiLevel: z.enum(['easy', 'medium', 'hard']).optional(),
  })
  .refine(
    (value) => Boolean(value.opponentId) !== Boolean(value.aiLevel),
    'Choisissez un seul adversaire.',
  );

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const user = await requireUser();
    const value = await body(request, input);
    const gameId = await createGame({ userId: user.id, ...value });
    return success({ gameId }, requestId, 201);
  } catch (error) {
    return failure(error, requestId);
  }
}
