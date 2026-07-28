import { NextRequest } from 'next/server';
import { z } from 'zod';

import { issuePasswordReset } from '@/server/auth';
import { getDb, type Row } from '@/server/db';
import { sendPasswordResetEmail } from '@/server/email';
import { assertMutationOrigin, body, failure, success } from '@/server/http';
import { consumeRateLimit } from '@/server/security/rate-limit';

export const runtime = 'nodejs';

const input = z.object({ identifier: z.string().trim().min(1).max(320) });

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const value = await body(request, input);
    const normalized = value.identifier.toLowerCase();
    await consumeRateLimit(`password-reset:${normalized}`, 3, 60 * 60);
    const db = await getDb();
    const user = (
      await db.query<Row>(
        'SELECT username,email FROM users WHERE LOWER(username)=? OR LOWER(email)=? LIMIT 1',
        [normalized, normalized],
      )
    )[0];

    let debugToken: string | undefined;
    if (user) {
      const token = await issuePasswordReset(String(user.username));
      if (token && user.email) {
        await sendPasswordResetEmail(String(user.email), String(user.username), token);
      }
      if (token && process.env.NODE_ENV !== 'production') debugToken = token;
    }

    return success(
      {
        accepted: true,
        message:
          'Si un compte correspond et possède une adresse e-mail, un lien valable une heure a été envoyé.',
        ...(debugToken ? { debugToken } : {}),
      },
      requestId,
    );
  } catch (error) {
    return failure(error, requestId);
  }
}
