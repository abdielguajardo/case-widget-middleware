import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildConfigResponse } from "../lib/case-widget";
import { setCorsHeaders } from "../lib/cors";
import { normalizeDomain } from "../lib/domain";
import { getDomainConfig } from "../lib/kv";
import {
  buildRequestLogContext,
  getErrorMessage,
  logEvent,
} from "../lib/logging";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const originHeader =
    typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  const domain = normalizeDomain(originHeader);
  const logContext = buildRequestLogContext(req, "/api/config", {
    origin: originHeader,
    domain: domain ?? undefined,
  });

  if (req.method === "OPTIONS") {
    const config = domain ? await getDomainConfig(domain) : null;
    setCorsHeaders(res, "GET, OPTIONS", config ? originHeader : undefined);
    logEvent("info", "config.preflight", logContext, {
      status: 204,
      allowedOrigin: Boolean(config),
    });
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    setCorsHeaders(res, "GET, OPTIONS");
    logEvent("warn", "config.method_not_allowed", logContext, {
      status: 405,
    });
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!domain) {
    setCorsHeaders(res, "GET, OPTIONS");
    logEvent("warn", "config.missing_origin", logContext, {
      status: 400,
    });
    return res.status(400).json({ error: "Missing origin header" });
  }
  try {
    const config = await getDomainConfig(domain);
    setCorsHeaders(res, "GET, OPTIONS", config ? originHeader : undefined);
    logEvent("info", "config.resolved", logContext, {
      status: 200,
      allowed: Boolean(config),
      configVersion: config?.config_version ?? null,
    });
    return res.status(200).json(buildConfigResponse(config));
  } catch (error) {
    setCorsHeaders(res, "GET, OPTIONS");
    logEvent("error", "config.error", logContext, {
      status: 500,
      error: getErrorMessage(error),
    });
    return res.status(500).json({ error: "Internal server error" });
  }
}
