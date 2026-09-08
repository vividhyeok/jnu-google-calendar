export async function notifyDiscord(content: string, username?: string) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return;
  try {
    const url = new URL(webhook);
    if (url.protocol !== 'https:' || url.hostname !== 'discord.com' || !url.pathname.startsWith('/api/webhooks/')) {
      throw new Error('Invalid webhook');
    }
    const body = username
      ? { content, username, allowed_mentions: { parse: [] } }
      : { content, allowed_mentions: { parse: [] } };
    const response = await fetch(url, {
      method: 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('Webhook failed');
    console.info('Notification sent');
  } catch {
    console.warn('Discord notification failed; sync result preserved');
  }
}
