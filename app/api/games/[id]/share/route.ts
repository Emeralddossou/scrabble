import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { resolveGameUuid, setReplaySharing } from '@/server/game/service';
import { assertMutationOrigin, body, failure, success } from '@/server/http';

export const runtime = 'nodejs';

const input = z.object({ enabled: z.boolean() });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const user = await requireUser();
    const gameId = await resolveGameUuid((await context.params).id);
    const result = await setReplaySharing(gameId, user.id, (await body(request, input)).enabled);
    return success(
      result.enabled && result.token
        ? { enabled: true, sharePath: `/replay/shared/${result.token}` }
        : { enabled: false },
      requestId,
    );
  } catch (error) {
    return failure(error, requestId);
  }
}
