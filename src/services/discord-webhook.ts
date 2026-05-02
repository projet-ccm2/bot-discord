export interface SendEmbedOptions {
  title?: string;
  color?: number;
}

const DISCORD_ALLOWED_HOSTS = new Set([
  "discord.com",
  "discordapp.com",
  "ptb.discord.com",
  "canary.discord.com",
]);

function validateDiscordWebhookUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid Discord webhook URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Discord webhook URL must use HTTPS");
  }
  if (!DISCORD_ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error("Discord webhook URL must target a Discord domain");
  }
  return parsed;
}

export async function sendEmbed(
  webhookUrl: string,
  text: string,
  options?: SendEmbedOptions,
): Promise<void> {
  const safeUrl = validateDiscordWebhookUrl(webhookUrl);

  const embed: Record<string, unknown> = {
    description: text,
  };
  if (options?.title) {
    embed.title = options.title;
  }
  if (options?.color != null) {
    embed.color = options.color;
  }

  const body = { embeds: [embed] };

  const response = await fetch(safeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const status = response.status;
    const bodyText = await response.text();
    const suffix = bodyText ? ` - ${bodyText}` : "";
    throw new Error(
      `Discord webhook failed: ${status} ${response.statusText}${suffix}`,
    );
  }
}
