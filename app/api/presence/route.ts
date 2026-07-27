import { NextRequest } from 'next/server';

import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db';
import { assertMutationOrigin, failure, success } from '@/server/http';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const user = await requireUser();
    const db = await getDb();
    const updated = await db.execute(
      'UPDATE presence SET last_seen=CURRENT_TIMESTAMP WHERE user_id=?',
      [user.id],
    );
    if (!updated.affectedRows)
      await db.execute('INSERT INTO presence(user_id) VALUES(?)', [user.id]);
    return success({ onlineForSeconds: 90 }, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
