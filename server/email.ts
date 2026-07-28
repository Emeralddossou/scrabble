type ResetDelivery = {
  delivered: boolean;
  reason?: 'missing_configuration' | 'provider_error';
};

export async function sendPasswordResetEmail(
  recipient: string,
  username: string,
  token: string,
): Promise<ResetDelivery> {
  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.EMAIL_FROM;
  const appUrl = process.env.APP_URL;
  if (!apiKey || !sender || !appUrl) {
    return { delivered: false, reason: 'missing_configuration' };
  }

  const resetUrl = new URL('/reset-password', appUrl);
  resetUrl.searchParams.set('token', token);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: sender,
      to: [recipient],
      subject: 'Réinitialisation de votre mot de passe LexiForge',
      html: `<p>Bonjour ${escapeHtml(username)},</p><p>Une réinitialisation de mot de passe a été demandée pour votre compte LexiForge.</p><p><a href="${resetUrl.toString()}">Choisir un nouveau mot de passe</a></p><p>Ce lien expire dans une heure. Ignorez ce message si vous n’êtes pas à l’origine de la demande.</p>`,
      text: `Bonjour ${username},\n\nChoisissez un nouveau mot de passe avec ce lien : ${resetUrl.toString()}\n\nCe lien expire dans une heure.`,
    }),
  });

  if (!response.ok) {
    console.error('Password reset email provider error', response.status, await response.text());
    return { delivered: false, reason: 'provider_error' };
  }
  return { delivered: true };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character];
  });
}
