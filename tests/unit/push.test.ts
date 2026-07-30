import { describe, expect, it } from 'vitest';

import { shouldClaimDailyDelivery } from '@/server/push';

describe('planification des rappels push', () => {
  const now = new Date('2026-07-30T12:00:00.000Z');

  it('déclenche une première livraison uniquement à l’heure choisie', () => {
    expect(shouldClaimDailyDelivery(18, 18, undefined, now)).toBe(true);
    expect(shouldClaimDailyDelivery(18, 17, undefined, now)).toBe(false);
  });

  it('reprend une livraison échouée sans renvoyer une livraison réussie', () => {
    expect(
      shouldClaimDailyDelivery(18, 19, { status: 'failed', createdAt: '2026-07-30 10:00:00' }, now),
    ).toBe(true);
    expect(
      shouldClaimDailyDelivery(18, 19, { status: 'sent', createdAt: '2026-07-30 10:00:00' }, now),
    ).toBe(false);
  });

  it('protège les envois concurrents et libère un verrou pending devenu ancien', () => {
    expect(
      shouldClaimDailyDelivery(18, 18, { status: 'pending', createdAt: '2026-07-30 11:55:00' }, now),
    ).toBe(false);
    expect(
      shouldClaimDailyDelivery(18, 19, { status: 'pending', createdAt: '2026-07-30 11:30:00' }, now),
    ).toBe(true);
  });
});
