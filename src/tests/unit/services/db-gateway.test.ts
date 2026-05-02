import { getChannelById } from "../../../services/db-gateway";

const mockFetch = jest.fn();
beforeEach(() => {
  (global as unknown as { fetch: typeof fetch }).fetch = mockFetch;
  mockFetch.mockReset();
});

describe("getChannelById", () => {
  it("should return channel with discordWebhookUrl", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: "ch1",
        name: "Channel One",
        discordWebhookUrl: "https://discord.com/api/webhooks/123/abc",
      }),
    });

    const result = await getChannelById("https://gateway.example.com", "ch1");

    expect(result).toEqual({
      id: "ch1",
      name: "Channel One",
      discordWebhookUrl: "https://discord.com/api/webhooks/123/abc",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://gateway.example.com/channels/ch1",
      expect.objectContaining({
        method: "GET",
        headers: { Accept: "application/json" },
      }),
    );
  });

  it("should return channel without discordWebhookUrl", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "ch2", name: "Channel Two" }),
    });

    const result = await getChannelById("https://gateway.example.com", "ch2");

    expect(result.id).toBe("ch2");
    expect(result.name).toBe("Channel Two");
    expect(result.discordWebhookUrl).toBeUndefined();
  });

  it("should ignore non-string discordWebhookUrl in response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: "ch2",
        name: "Channel Two",
        discordWebhookUrl: 123,
      }),
    });

    const result = await getChannelById("https://gateway.example.com", "ch2");

    expect(result.discordWebhookUrl).toBeUndefined();
  });

  it("should strip trailing slash from baseUrl", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "ch3", name: "Three" }),
    });

    await getChannelById("https://gateway.example.com/", "ch3");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gateway.example.com/channels/ch3",
      expect.any(Object),
    );
  });

  it("should encode channelId in URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "ch/with/slash", name: "Slash" }),
    });

    await getChannelById("https://gateway.example.com", "ch/with/slash");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gateway.example.com/channels/ch%2Fwith%2Fslash",
      expect.any(Object),
    );
  });

  it("should throw ChannelNotFoundError on 404", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(
      getChannelById("https://gateway.example.com", "missing"),
    ).rejects.toMatchObject({
      name: "ChannelNotFoundError",
      message: "Channel not found: missing",
    });
  });

  it("should throw DbGatewayError on 500", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(
      getChannelById("https://gateway.example.com", "ch1"),
    ).rejects.toMatchObject({
      name: "DbGatewayError",
      message: expect.stringContaining("DB-gateway error"),
    });
  });

  it("should throw DbGatewayError on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(
      getChannelById("https://gateway.example.com", "ch1"),
    ).rejects.toMatchObject({
      name: "DbGatewayError",
      message: expect.stringContaining("Failed to fetch channel"),
    });
  });
});
