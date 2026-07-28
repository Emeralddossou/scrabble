import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { getDb, type Row } from '@/server/db';
import { assertMutationOrigin, body, failure, success } from '@/server/http';
import { AppError } from '@/server/security/errors';

export const runtime = 'nodejs';

const updateInput = z.object({
  bio: z.string().trim().max(500),
  avatar: z.enum(['tile', 'owl', 'fox', 'tiger', 'wizard', 'crown']),
  email: z.union([z.literal(''), z.string().trim().toLowerCase().email().max(320)]),
});

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const session = await requireUser();
    const db = await getDb();
    const user = (
      await db.query<Row>(
        `SELECT id,username,email,bio,avatar,wins,losses,draws,created_at
         FROM users WHERE id=?`,
        [session.id],
      )
    )[0];
    const games = await db.query<Row>(
      `SELECT g.id,g.status,g.mode,g.is_solo,g.ai_level,g.winner_id,g.created_at,g.ended_at,
              other.user_id AS opponent_id,u.username AS opponent
       FROM games g
       JOIN game_players mine ON mine.game_id=g.id AND mine.user_id=?
       JOIN game_players other ON other.game_id=g.id AND other.user_id<>?
       JOIN users u ON u.id=other.user_id
       ORDER BY g.created_at DESC LIMIT 20`,
      [session.id, session.id],
    );
    return success({ user, games }, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const session = await requireUser();
    const value = await body(request, updateInput);
    const email = value.email || null;
    const db = await getDb();
    if (email) {
      const duplicate = (
        await db.query<Row>('SELECT id FROM users WHERE LOWER(email)=LOWER(?) AND id<>?', [
          email,
          session.id,
        ])
      )[0];
      if (duplicate) {
        throw new AppError('EMAIL_TAKEN', 409, 'Cette adresse e-mail est déjà utilisée.');
      }
    }
    await db.execute('UPDATE users SET bio=?,avatar=?,email=? WHERE id=?', [
      value.bio,
      value.avatar,
      email,
      session.id,
    ]);
    return success({ updated: true }, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
