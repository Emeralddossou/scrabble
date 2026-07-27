import { currentUser } from '@/server/auth';
import { failure, success } from '@/server/http';

export const runtime = 'nodejs';
export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    return success({ user: await currentUser() }, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
