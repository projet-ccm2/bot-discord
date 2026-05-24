import { logger } from "../utils/logger";
import { timedFetch } from "../utils/http";

export interface Channel {
  id: string;
  name: string;
  discordWebhookUrl?: string | null;
}

export class ChannelNotFoundError extends Error {
  constructor(channelId: string) {
    super(`Channel not found: ${channelId}`);
    this.name = "ChannelNotFoundError";
  }
}

export class DbGatewayError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "DbGatewayError";
  }
}

export async function getChannelById(
  baseUrl: string,
  channelId: string,
): Promise<Channel> {
  const url = `${baseUrl.replace(/\/$/, "")}/channels/${encodeURIComponent(channelId)}`;

  logger.debug("getChannelById → request", { url });

  let response: Response;
  try {
    response = await timedFetch({
      url,
      method: "GET",
      init: { method: "GET", headers: { Accept: "application/json" } },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    throw new DbGatewayError(`Failed to fetch channel: ${message}`);
  }

  logger.debug("getChannelById → response", { status: response.status, url });

  if (response.status === 404) {
    throw new ChannelNotFoundError(channelId);
  }

  if (!response.ok) {
    let responseBody = "";
    try {
      responseBody = await response.text();
    } catch {
      // best-effort
    }
    logger.error("getChannelById → error response", {
      status: response.status,
      body: responseBody,
      url,
    });
    throw new DbGatewayError(
      `DB-gateway error: ${response.status} ${response.statusText}`,
      response.status,
    );
  }

  const body = (await response.json()) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : String(body.id);
  const name = typeof body.name === "string" ? body.name : "";

  let discordWebhookUrl: string | undefined;
  const rawUrl = body.discordWebhookUrl;
  if (rawUrl != null && typeof rawUrl === "string") {
    discordWebhookUrl = rawUrl;
  } else {
    discordWebhookUrl = undefined;
  }

  logger.debug("getChannelById → resolved channel", {
    id,
    name,
    hasWebhook: discordWebhookUrl != null,
    ...(process.env.NODE_ENV === "development" && { discordWebhookUrl }),
  });

  return { id, name, discordWebhookUrl };
}
