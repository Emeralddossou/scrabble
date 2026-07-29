import { NextRequest } from 'next/server';

import { requireUser } from '@/server/auth';
import { resolveGameUuid, suggestionsForGame } from '@/server/game/service';
import { failure, success } from '@/server/http';

export const runtime = 'nodejs';
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const gameId = await resolveGameUuid((await context.params).id);
    return success(
      { suggestions: await suggestionsForGame(gameId, user.id) },
      requestId,
    );
  } catch (error) {
    return failure(error, requestId);
  }
}
