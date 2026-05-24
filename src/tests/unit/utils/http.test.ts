import jwt from "jsonwebtoken";
import {
  isCloudRun,
  extractAudience,
  generateVpcToken,
  fetchIdentityToken,
  timedFetch,
  tokenCache,
} from "../../../utils/http";

const mockFetch = jest.fn();

beforeEach(() => {
  (global as unknown as { fetch: typeof fetch }).fetch = mockFetch;
  mockFetch.mockReset();
  tokenCache.clear();
  delete process.env.K_SERVICE;
  delete process.env.JWT_SECRET;
});

describe("isCloudRun", () => {
  it("returns true when K_SERVICE is set", () => {
    process.env.K_SERVICE = "bot-discord";
    expect(isCloudRun()).toBe(true);
  });

  it("returns false when K_SERVICE is not set", () => {
    expect(isCloudRun()).toBe(false);
  });
});

describe("extractAudience", () => {
  it("returns protocol + host for https URL", () => {
    expect(extractAudience("https://api.example.com/v1/channels/123")).toBe(
      "https://api.example.com",
    );
  });

  it("returns protocol + host for URL with port", () => {
    expect(extractAudience("http://localhost:8080/channels")).toBe(
      "http://localhost:8080",
    );
  });
});

describe("generateVpcToken", () => {
  it("returns null when JWT_SECRET is not set", () => {
    expect(generateVpcToken()).toBeNull();
  });

  it("returns a signed JWT when JWT_SECRET is set", () => {
    process.env.JWT_SECRET = "test-secret";
    const token = generateVpcToken();
    expect(token).toBeTruthy();
    const decoded = jwt.verify(token!, "test-secret") as jwt.JwtPayload;
    expect(decoded.aud).toBe("vpc-db-gateway");
  });
});

describe("fetchIdentityToken", () => {
  it("fetches token from Google metadata server", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "google-id-token",
    });

    const token = await fetchIdentityToken("https://api.example.com");
    expect(token).toBe("google-id-token");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("metadata.google.internal"),
      expect.objectContaining({ headers: { "Metadata-Flavor": "Google" } }),
    );
  });

  it("caches token and avoids second fetch", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "cached-token",
    });

    await fetchIdentityToken("https://api.example.com");
    const token = await fetchIdentityToken("https://api.example.com");

    expect(token).toBe("cached-token");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws when metadata server returns non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    await expect(fetchIdentityToken("https://api.example.com")).rejects.toThrow(
      "Failed to fetch identity token for https://api.example.com (HTTP 403)",
    );
  });
});

describe("timedFetch", () => {
  it("calls fetch directly when not in Cloud Run", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await timedFetch({
      url: "https://api.example.com/data",
      method: "GET",
      init: { method: "GET", headers: { Accept: "application/json" } },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/data", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  });

  it("adds Authorization header in Cloud Run", async () => {
    process.env.K_SERVICE = "bot-discord";

    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => "id-token-abc" })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    await timedFetch({
      url: "https://api.example.com/data",
      method: "GET",
      init: { method: "GET", headers: { Accept: "application/json" } },
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [, actualInit] = mockFetch.mock.calls[1] as [
      string,
      Record<string, unknown>,
    ];
    const headers = actualInit.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer id-token-abc");
    expect(headers["Accept"]).toBe("application/json");
  });

  it("adds x-vpc-token header when JWT_SECRET is set in Cloud Run", async () => {
    process.env.K_SERVICE = "bot-discord";
    process.env.JWT_SECRET = "secret";

    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => "id-token" })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    await timedFetch({
      url: "https://api.example.com/data",
      method: "GET",
    });

    const [, actualInit] = mockFetch.mock.calls[1] as [
      string,
      Record<string, unknown>,
    ];
    const headers = actualInit.headers as Record<string, string>;
    expect(headers["x-vpc-token"]).toBeTruthy();
    const decoded = jwt.verify(
      headers["x-vpc-token"],
      "secret",
    ) as jwt.JwtPayload;
    expect(decoded.aud).toBe("vpc-db-gateway");
  });

  it("does not add x-vpc-token when JWT_SECRET is not set", async () => {
    process.env.K_SERVICE = "bot-discord";

    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => "id-token" })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    await timedFetch({ url: "https://api.example.com/data", method: "GET" });

    const [, actualInit] = mockFetch.mock.calls[1] as [
      string,
      Record<string, unknown>,
    ];
    const headers = actualInit.headers as Record<string, string>;
    expect(headers["x-vpc-token"]).toBeUndefined();
  });
});
