import { requireUser } from '@/server/auth';
import { failure, success } from '@/server/http';
import { vapidPublicKey } from '@/server/push';

export const runtime = 'nodejs';

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    await requireUser();
    return success({ vapidPublicKey: vapidPublicKey() }, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
