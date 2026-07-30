import webpush, { type PushSubscription } from 'web-push';

type PushRow = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushSubscriptionInput = PushSubscription & {
  expirationTime?: number | null;
};

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

function vapidConfiguration(): { subject: string; publicKey: string; privateKey: string } {
  const publicKey = vapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) {
    throw new Error('Les variables VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT sont requises.');
  }
  return { subject, publicKey, privateKey };
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat('fr-FR', { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function localDateTime(
  timeZone: string,
  now: Date = new Date(),
): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour')),
  };
}

export async function sendDailyReminder(subscription: PushRow): Promise<void> {
  const { subject, publicKey, privateKey } = vapidConfiguration();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify({
      title: 'LexiForge',
      body: 'Une petite partie de Scrabble vous attend.',
      tag: 'daily-reminder',
      url: '/dashboard?quick=solo',
    }),
    { TTL: 60 * 60, urgency: 'low' },
  );
}

export function pushErrorStatus(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'statusCode' in error
    ? Number(error.statusCode)
    : undefined;
}
