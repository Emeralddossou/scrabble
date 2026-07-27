import { NextRequest } from 'next/server';

import { clearSession } from '@/server/auth';
import { assertMutationOrigin, failure, success } from '@/server/http';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    await clearSession();
    return success(null, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
