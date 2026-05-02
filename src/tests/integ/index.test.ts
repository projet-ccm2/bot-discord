import request from "supertest";
import app from "../../index";
import { config } from "../../config/environment";

jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockGetChannelById = jest.fn();
const mockSendEmbed = jest.fn();
jest.mock("../../services/db-gateway", () => ({
  getChannelById: (...args: unknown[]) => mockGetChannelById(...args),
  ChannelNotFoundError: class ChannelNotFoundError extends Error {
    constructor(id: string) {
      super(`Channel not found: ${id}`);
      this.name = "ChannelNotFoundError";
    }
  },
}));
jest.mock("../../services/discord-webhook", () => ({
  sendEmbed: (...args: unknown[]) => mockSendEmbed(...args),
}));

describe("Express App", () => {
  describe("GET /health", () => {
    it("should return health status with correct structure", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "healthy");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("environment", config.nodeEnv);
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it("should return a valid ISO timestamp", async () => {
      const response = await request(app).get("/health");
      const timestamp = new Date(response.body.timestamp);

      expect(timestamp.toISOString()).toBe(response.body.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });

  describe("Server configuration", () => {
    it("should have x-powered-by header disabled", () => {
      expect(app.get("x-powered-by")).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("should handle unknown routes with 404", async () => {
      const response = await request(app).get("/unknown-route");
      expect(response.status).toBe(404);
    });
  });

  describe("POST /notify", () => {
    beforeEach(() => {
      mockGetChannelById.mockReset();
      mockSendEmbed.mockReset();
    });

    it("should return 200 and send embed when channel has webhook", async () => {
      mockGetChannelById.mockResolvedValueOnce({
        id: "ch1",
        name: "Channel",
        discordWebhookUrl: "https://discord.com/api/webhooks/1/abc",
      });
      mockSendEmbed.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post("/notify")
        .send({ channelId: "ch1", text: "Hello" })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(mockGetChannelById).toHaveBeenCalledWith(
        config.dbGatewayBaseUrl,
        "ch1",
      );
      expect(mockSendEmbed).toHaveBeenCalledWith(
        "https://discord.com/api/webhooks/1/abc",
        "Hello",
        { title: undefined },
      );
    });

    it("should pass optional title to sendEmbed", async () => {
      mockGetChannelById.mockResolvedValueOnce({
        id: "ch1",
        name: "Channel",
        discordWebhookUrl: "https://discord.com/api/webhooks/1/abc",
      });
      mockSendEmbed.mockResolvedValueOnce(undefined);

      await request(app)
        .post("/notify")
        .send({ channelId: "ch1", text: "Body", title: "Title" })
        .set("Content-Type", "application/json");

      expect(mockSendEmbed).toHaveBeenCalledWith(
        "https://discord.com/api/webhooks/1/abc",
        "Body",
        { title: "Title" },
      );
    });

    it("should return 400 when channelId is missing", async () => {
      const response = await request(app)
        .post("/notify")
        .send({ text: "Hello" })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("channelId required");
      expect(mockGetChannelById).not.toHaveBeenCalled();
    });

    it("should return 400 when text is missing", async () => {
      const response = await request(app)
        .post("/notify")
        .send({ channelId: "ch1" })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("text required");
      expect(mockGetChannelById).not.toHaveBeenCalled();
    });

    it("should return 404 when channel is not found", async () => {
      const { ChannelNotFoundError } = require("../../services/db-gateway");
      mockGetChannelById.mockRejectedValueOnce(new ChannelNotFoundError("ch1"));

      const response = await request(app)
        .post("/notify")
        .send({ channelId: "ch1", text: "Hello" })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Channel not found");
    });

    it("should return 404 when channel has no webhook URL", async () => {
      mockGetChannelById.mockResolvedValueOnce({
        id: "ch1",
        name: "Channel",
        discordWebhookUrl: null,
      });

      const response = await request(app)
        .post("/notify")
        .send({ channelId: "ch1", text: "Hello" })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("no Discord webhook");
      expect(mockSendEmbed).not.toHaveBeenCalled();
    });

    it("should return 404 when channel has empty string webhook URL", async () => {
      mockGetChannelById.mockResolvedValueOnce({
        id: "ch1",
        name: "Channel",
        discordWebhookUrl: "",
      });

      const response = await request(app)
        .post("/notify")
        .send({ channelId: "ch1", text: "Hello" })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(404);
      expect(mockSendEmbed).not.toHaveBeenCalled();
    });

    it("should return 502 when sendEmbed fails", async () => {
      mockGetChannelById.mockResolvedValueOnce({
        id: "ch1",
        name: "Channel",
        discordWebhookUrl: "https://discord.com/api/webhooks/1/abc",
      });
      mockSendEmbed.mockRejectedValueOnce(new Error("Discord API error"));

      const response = await request(app)
        .post("/notify")
        .send({ channelId: "ch1", text: "Hello" })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(502);
      expect(response.body.error).toBe("Failed to send notification");
    });
  });
});
