import { NextRequest } from 'next/server';

import { requireUser } from '@/server/auth';
import { suggestionsForGame } from '@/server/game/service';
import { failure, success } from '@/server/http';

export const runtime = 'nodejs';
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    return success(
      { suggestions: await suggestionsForGame(Number((await context.params).id), user.id) },
      requestId,
    );
  } catch (error) {
    return failure(error, requestId);
  }
}
