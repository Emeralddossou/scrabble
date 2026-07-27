import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { getDb, type Row } from '@/server/db';
import { createGame } from '@/server/game/service';
import { assertMutationOrigin, body, failure, success } from '@/server/http';
import { AppError } from '@/server/security/errors';

export const runtime = 'nodejs';
const input = z.object({ action: z.enum(['accept', 'decline', 'cancel']) });
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const user = await requireUser();
    const value = await body(request, input);
    const db = await getDb();
    const id = Number((await context.params).id);
    const invitation = (
      await db.query<Row>(
        "SELECT * FROM invitations WHERE id=? AND status='pending' AND expires_at>CURRENT_TIMESTAMP",
        [id],
      )
    )[0];
    if (!invitation)
      throw new AppError('INVITATION_UNAVAILABLE', 404, 'Invitation introuvable ou expirée.');
    if (value.action === 'cancel') {
      if (Number(invitation.from_user_id) !== user.id)
        throw new AppError('FORBIDDEN', 403, 'Seul l’émetteur peut annuler cette invitation.');
      await db.execute(
        "UPDATE invitations SET status='cancelled',active_key=NULL WHERE id=? AND status='pending'",
        [id],
      );
      return success({ cancelled: true }, requestId);
    }
    if (Number(invitation.to_user_id) !== user.id)
      throw new AppError('FORBIDDEN', 403, 'Cette invitation ne vous est pas destinée.');
    if (value.action === 'decline') {
      await db.execute(
        "UPDATE invitations SET status='declined',active_key=NULL WHERE id=? AND status='pending'",
        [id],
      );
      return success({ declined: true }, requestId);
    }
    const gameId = await createGame({
      userId: Number(invitation.from_user_id),
      opponentId: user.id,
      mode: invitation.mode === 'timer' ? 'timer' : 'free',
      timeLimitMinutes: Math.max(1, Math.floor(Number(invitation.time_limit_seconds) / 60)),
      incrementSeconds: Number(invitation.increment_seconds),
    });
    const changed = await db.execute(
      "UPDATE invitations SET status='accepted',active_key=NULL WHERE id=? AND status='pending'",
      [id],
    );
    if (!changed.affectedRows)
      throw new AppError('INVITATION_UNAVAILABLE', 409, 'Invitation déjà traitée.');
    return success({ gameId }, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
