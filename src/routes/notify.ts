import { Router, Request, Response } from "express";
import { config } from "../config/environment";
import { getChannelById, ChannelNotFoundError } from "../services/db-gateway";
import { sendEmbed } from "../services/discord-webhook";
import { logger } from "../utils/logger";

const router = Router();

interface NotifyBody {
  channelId?: string;
  title?: string;
  text?: string;
}

router.post("/notify", async (req: Request, res: Response): Promise<void> => {
  const body = req.body as NotifyBody;

  const channelId =
    typeof body.channelId === "string" ? body.channelId.trim() : undefined;
  const text = typeof body.text === "string" ? body.text.trim() : undefined;
  const title =
    typeof body.title === "string" ? body.title.trim() || undefined : undefined;

  if (!channelId) {
    res.status(400).json({ error: "channelId required" });
    return;
  }
  if (!text) {
    res.status(400).json({ error: "text required" });
    return;
  }

  try {
    const channel = await getChannelById(config.dbGatewayBaseUrl, channelId);
    const webhookUrl = channel.discordWebhookUrl; // Ne jamais logger cette URL (secret)

    if (!webhookUrl || webhookUrl.length === 0) {
      logger.warn("Channel has no Discord webhook URL", {
        channelId,
      });
      res
        .status(404)
        .json({ error: "Channel has no Discord webhook configured" });
      return;
    }

    await sendEmbed(webhookUrl, text, { title });
    res.status(200).json({ success: true });
  } catch (err) {
    if (err instanceof ChannelNotFoundError) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    logger.error("Notify failed", {
      channelId,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(502).json({
      error: "Failed to send notification",
    });
  }
});

export default router;
