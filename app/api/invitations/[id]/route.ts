import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { getDb, type Row } from '@/server/db';
import { acceptInvitation } from '@/server/game/service';
import { assertMutationOrigin, body, failure, success } from '@/server/http';
import { AppError, conflict } from '@/server/security/errors';

export const runtime = 'nodejs';
const input = z.object({ action: z.enum(['accept', 'decline', 'cancel']) });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const user = await requireUser();
    const value = await body(request, input);
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new AppError('INVALID_INVITATION_ID', 422, 'Identifiant d’invitation invalide.');
    }

    if (value.action === 'accept') {
      return success({ gameId: await acceptInvitation(id, user.id) }, requestId);
    }

    const db = await getDb();
    const invitation = (
      await db.query<Row>(
        "SELECT * FROM invitations WHERE id=? AND status='pending' AND expires_at>CURRENT_TIMESTAMP",
        [id],
      )
    )[0];
    if (!invitation) {
      throw new AppError('INVITATION_UNAVAILABLE', 404, 'Invitation introuvable ou expirée.');
    }

    if (value.action === 'cancel') {
      if (Number(invitation.from_user_id) !== user.id) {
        throw new AppError('FORBIDDEN', 403, 'Seul l’émetteur peut annuler cette invitation.');
      }
      const changed = await db.execute(
        "UPDATE invitations SET status='cancelled',active_key=NULL WHERE id=? AND status='pending'",
        [id],
      );
      if (changed.affectedRows !== 1) throw conflict('Invitation déjà traitée.');
      return success({ cancelled: true }, requestId);
    }

    if (Number(invitation.to_user_id) !== user.id) {
      throw new AppError('FORBIDDEN', 403, 'Cette invitation ne vous est pas destinée.');
    }
    const changed = await db.execute(
      "UPDATE invitations SET status='declined',active_key=NULL WHERE id=? AND status='pending'",
      [id],
    );
    if (changed.affectedRows !== 1) throw conflict('Invitation déjà traitée.');
    return success({ declined: true }, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
