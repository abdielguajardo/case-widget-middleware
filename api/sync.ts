import type { VercelRequest, VercelResponse } from "@vercel/node";
import { normalizeDomain } from "../lib/domain";
import { verifyHmacSignature } from "../lib/hmac";
import { setDomainConfig, deleteDomainConfig } from "../lib/kv";
import {
  buildRequestLogContext,
  getErrorMessage,
  logEvent,
} from "../lib/logging";
import { readJsonBody } from "../lib/request-body";
import { validateSyncPayload } from "../lib/sync";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const logContext = buildRequestLogContext(req, "/api/sync");

  if (req.method !== "POST") {
    logEvent("warn", "sync.method_not_allowed", logContext, {
      status: 405,
    });
    return res.status(405).json({ error: "Method not allowed" });
  }

  const signature = req.headers["x-signature"] as string;

  if (!signature) {
    logEvent("warn", "sync.missing_signature", logContext, {
      status: 401,
    });
    return res.status(401).json({ error: "Missing signature" });
  }

  const bodyResult = await readJsonBody(req);

  if (!bodyResult.ok) {
    logEvent("warn", "sync.invalid_json_body", logContext, {
      status: 400,
    });
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const isValid = verifyHmacSignature(
    bodyResult.rawBody,
    signature,
    process.env.HMAC_SECRET!
  );

  if (!isValid) {
    logEvent("warn", "sync.invalid_signature", logContext, {
      status: 401,
    });
    return res.status(401).json({ error: "Invalid signature" });
  }

  const validation = validateSyncPayload(bodyResult.value);

  if (!validation.ok) {
    logEvent("warn", "sync.validation_failed", logContext, {
      status: 400,
      error: validation.error,
    });
    return res.status(400).json({ error: validation.error });
  }

  try {
    const normalizedDomain = normalizeDomain(validation.value.domain);

    if (!normalizedDomain) {
      logEvent("warn", "sync.invalid_domain", logContext, {
        status: 400,
      });
      return res.status(400).json({ error: "Invalid domain" });
    }

    const domainLogContext = {
      ...logContext,
      domain: normalizedDomain,
    };

    if (validation.value.action === "upsert") {
      await setDomainConfig(normalizedDomain, validation.value.config!);
      logEvent("info", "sync.upserted", domainLogContext, {
        status: 200,
        configVersion: validation.value.config?.config_version ?? null,
        typeOptionCount: validation.value.config?.type_options.length ?? 0,
      });
      return res
        .status(200)
        .json({ ok: true, action: "upsert", domain: normalizedDomain });
    }

    await deleteDomainConfig(normalizedDomain);
    logEvent("info", "sync.deleted", domainLogContext, {
      status: 200,
    });
    return res
      .status(200)
      .json({ ok: true, action: "delete", domain: normalizedDomain });

  } catch (error) {
    logEvent("error", "sync.error", logContext, {
      status: 500,
      error: getErrorMessage(error),
    });
    return res.status(500).json({ error: "Internal server error" });
  }
}
