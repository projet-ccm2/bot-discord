import jwt from "jsonwebtoken";
import { logger } from "./logger";

const VPC_AUDIENCE = "vpc-db-gateway";
const TOKEN_TTL_MS = 55 * 60 * 1000;

export const tokenCache = new Map<
  string,
  { token: string; expiresAt: number }
>();

export function isCloudRun(): boolean {
  return Boolean(process.env.K_SERVICE);
}

export function extractAudience(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

export function generateVpcToken(): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return jwt.sign(
    { aud: VPC_AUDIENCE, iat: Math.floor(Date.now() / 1000) },
    secret,
    { expiresIn: 3600 },
  );
}

export async function fetchIdentityToken(audience: string): Promise<string> {
  const cached = tokenCache.get(audience);
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  const metadataUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`;
  const r = await fetch(metadataUrl, {
    headers: { "Metadata-Flavor": "Google" },
  });
  if (!r.ok)
    throw new Error(
      `Failed to fetch identity token for ${audience} (HTTP ${r.status})`,
    );
  const token = await r.text();
  tokenCache.set(audience, { token, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

export interface TimedFetchOptions {
  url: string;
  method: string;
  init?: Parameters<typeof fetch>[1];
}

export async function timedFetch(
  options: TimedFetchOptions,
): Promise<Response> {
  let init: Parameters<typeof fetch>[1] = options.init ?? {
    method: options.method,
  };
  if (isCloudRun()) {
    const audience = extractAudience(options.url);
    logger.debug("timedFetch → Cloud Run auth", {
      url: options.url,
      audience,
      hasVpcSecret: Boolean(process.env.JWT_SECRET),
    });
    const idToken = await fetchIdentityToken(audience);
    const vpcToken = generateVpcToken();
    const existingHeaders =
      (init.headers as Record<string, string> | undefined) ?? {};
    const authHeaders: Record<string, string> = {
      ...existingHeaders,
      Authorization: `Bearer ${idToken}`,
    };
    if (vpcToken) authHeaders["x-vpc-token"] = vpcToken;
    init = { ...init, headers: authHeaders };
  } else {
    logger.debug("timedFetch → no auth (K_SERVICE not set)", {
      url: options.url,
    });
  }
  return fetch(options.url, init);
}
