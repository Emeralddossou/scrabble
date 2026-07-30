import { sharedReplayState } from '@/server/game/service';
import { failure, success } from '@/server/http';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    return success(await sharedReplayState((await context.params).token), requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
