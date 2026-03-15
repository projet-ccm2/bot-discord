export interface SendEmbedOptions {
  title?: string;
  color?: number;
}

/**
 * Sends an embed message to a Discord webhook URL.
 * @param webhookUrl - Full Discord webhook URL (https://discord.com/api/webhooks/...)
 * @param text - Embed description content
 * @param options - Optional title and color (decimal integer)
 * @throws Error on non-2xx response from Discord
 */
export async function sendEmbed(
  webhookUrl: string,
  text: string,
  options?: SendEmbedOptions,
): Promise<void> {
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

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const status = response.status;
    const bodyText = await response.text();
    throw new Error(
      `Discord webhook failed: ${status} ${response.statusText}${bodyText ? ` - ${bodyText}` : ""}`,
    );
  }
}
