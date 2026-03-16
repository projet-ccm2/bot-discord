export interface SendEmbedOptions {
  title?: string;
  color?: number;
}

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
    const suffix = bodyText ? ` - ${bodyText}` : "";
    throw new Error(
      `Discord webhook failed: ${status} ${response.statusText}${suffix}`,
    );
  }
}
