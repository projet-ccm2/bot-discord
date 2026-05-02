import { sendEmbed } from "../../../services/discord-webhook";

const mockFetch = jest.fn();
beforeEach(() => {
  (global as unknown as { fetch: typeof fetch }).fetch = mockFetch;
  mockFetch.mockReset();
});

describe("sendEmbed", () => {
  it("should POST embed with description only", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

    await sendEmbed("https://discord.com/api/webhooks/1/token", "Hello world");

    expect(mockFetch).toHaveBeenCalledWith(
      new URL("https://discord.com/api/webhooks/1/token"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      embeds: [{ description: "Hello world" }],
    });
  });

  it("should include title and color when provided", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

    await sendEmbed("https://discord.com/api/webhooks/2/tok", "Desc", {
      title: "My Title",
      color: 5763719,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.embeds[0]).toMatchObject({
      description: "Desc",
      title: "My Title",
      color: 5763719,
    });
  });

  it("should throw on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "Unknown webhook",
    });

    await expect(
      sendEmbed("https://discord.com/api/webhooks/1/token", "Hi"),
    ).rejects.toThrow("Discord webhook failed");
  });

  it("should throw on malformed URL", async () => {
    await expect(sendEmbed("not-a-url", "Hi")).rejects.toThrow(
      "Invalid Discord webhook URL",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should throw on non-HTTPS URL", async () => {
    await expect(
      sendEmbed("http://discord.com/api/webhooks/1/token", "Hi"),
    ).rejects.toThrow("Discord webhook URL must use HTTPS");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should throw on non-Discord domain", async () => {
    await expect(
      sendEmbed("https://evil.com/api/webhooks/1/token", "Hi"),
    ).rejects.toThrow("Discord webhook URL must target a Discord domain");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
