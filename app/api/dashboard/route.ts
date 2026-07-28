import { requireUser } from '@/server/auth';
import { getDb, type Row } from '@/server/db';
import { failure, success } from '@/server/http';

export const runtime = 'nodejs';

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const db = await getDb();
    const presence = await db.execute(
      'UPDATE presence SET last_seen=CURRENT_TIMESTAMP WHERE user_id=?',
      [user.id],
    );
    if (!presence.affectedRows) {
      try {
        await db.execute('INSERT INTO presence(user_id) VALUES(?)', [user.id]);
      } catch {
        await db.execute('UPDATE presence SET last_seen=CURRENT_TIMESTAMP WHERE user_id=?', [
          user.id,
        ]);
      }
    }

    await db.execute(
      "UPDATE invitations SET status='expired',active_key=NULL WHERE status='pending' AND expires_at<=CURRENT_TIMESTAMP AND (from_user_id=? OR to_user_id=?)",
      [user.id, user.id],
    );

    const [me] = await db.query<Row>(
      'SELECT id,username,bio,avatar,wins,losses,draws FROM users WHERE id=?',
      [user.id],
    );
    const games = await db.query<Row>(
      `SELECT g.id,g.status,g.mode,g.current_player_id,g.winner_id,g.created_at,
       MAX(CASE WHEN gp.user_id<>? THEN u.username END) AS opponent
       FROM games g JOIN game_players mine ON mine.game_id=g.id AND mine.user_id=?
       JOIN game_players gp ON gp.game_id=g.id JOIN users u ON u.id=gp.user_id
       GROUP BY g.id ORDER BY g.created_at DESC LIMIT 30`,
      [user.id, user.id],
    );
    const onlineThreshold =
      db.dialect === 'mysql'
        ? 'DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 SECOND)'
        : "DATETIME(CURRENT_TIMESTAMP,'-90 seconds')";
    const online = await db.query<Row>(
      `SELECT u.id,u.username,u.wins,u.losses,u.draws FROM presence p JOIN users u ON u.id=p.user_id
       WHERE p.user_id<>? AND p.last_seen>${onlineThreshold} AND u.username NOT LIKE 'LexiBot-%' ORDER BY u.username`,
      [user.id],
    );
    const invites = await db.query<Row>(
      `SELECT i.*,u.username AS from_username FROM invitations i JOIN users u ON u.id=i.from_user_id
       WHERE i.to_user_id=? AND i.status='pending' AND i.expires_at>CURRENT_TIMESTAMP ORDER BY i.created_at DESC`,
      [user.id],
    );
    const sentInvites = await db.query<Row>(
      `SELECT i.*,u.username AS to_username FROM invitations i JOIN users u ON u.id=i.to_user_id
       WHERE i.from_user_id=? AND i.status='pending' AND i.expires_at>CURRENT_TIMESTAMP ORDER BY i.created_at DESC`,
      [user.id],
    );
    const leaders = await db.query<Row>(
      "SELECT id,username,wins,losses,draws FROM users WHERE username NOT LIKE 'LexiBot-%' ORDER BY wins DESC,draws DESC,username LIMIT 10",
    );
    return success({ user: me, games, online, invites, sentInvites, leaders }, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
