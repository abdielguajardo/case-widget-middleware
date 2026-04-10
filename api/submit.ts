import type { VercelRequest, VercelResponse } from "@vercel/node";
import { privateDecrypt } from "crypto";
import { setCorsHeaders } from "../lib/cors";
import { normalizeDomain } from "../lib/domain";
import { getDomainConfig, rateLimitSubmit } from "../lib/kv";
import {
  buildRequestLogContext,
  getErrorMessage,
  logEvent,
} from "../lib/logging";
import { readJsonBody } from "../lib/request-body";
import {
  errorResponse,
  verifyRecaptchaToken,
  validateSubmitRequest,
} from "../lib/submit";
import { createCase, SalesforceRequestError } from "../lib/salesforce";

const MASTER_PRIVATE_KEY = process.env.MASTER_PRIVATE_KEY!;

function decryptSecretKey(encryptedValue: string): string {
  const privateKey = MASTER_PRIVATE_KEY.replace(/\\n/g, "\n");
  const encryptedBuffer = Buffer.from(encryptedValue, "base64");
  const decrypted = privateDecrypt(privateKey, encryptedBuffer);
  return decrypted.toString("utf8");
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const originHeader =
    typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  const domain = normalizeDomain(originHeader);
  const logContext = buildRequestLogContext(req, "/api/submit", {
    origin: originHeader,
    domain: domain ?? undefined,
  });

  if (req.method === "OPTIONS") {
    const siteConfig = domain ? await getDomainConfig(domain) : null;
    setCorsHeaders(res, "POST, OPTIONS", siteConfig ? originHeader : undefined);
    logEvent("info", "submit.preflight", logContext, {
      status: 204,
      allowedOrigin: Boolean(siteConfig),
    });
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    setCorsHeaders(res, "POST, OPTIONS");
    logEvent("warn", "submit.method_not_allowed", logContext, {
      status: 405,
    });
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!domain) {
    setCorsHeaders(res, "POST, OPTIONS");
    logEvent("warn", "submit.origin_not_allowed", logContext, {
      status: 403,
    });
    return res
      .status(403)
      .json(errorResponse({ general: ["origin_not_allowed"] }));
  }

  const siteConfig = await getDomainConfig(domain);

  if (!siteConfig) {
    setCorsHeaders(res, "POST, OPTIONS");
    logEvent("warn", "submit.site_not_found", logContext, {
      status: 404,
    });
    return res.status(404).json(errorResponse({ general: ["site_not_found"] }));
  }

  setCorsHeaders(res, "POST, OPTIONS", originHeader);

  if (logContext.clientIp) {
    const rateLimit = await rateLimitSubmit(domain, logContext.clientIp);

    if (!rateLimit.allowed) {
      logEvent("warn", "submit.rate_limited", logContext, {
        status: 429,
        limit: rateLimit.limit,
        count: rateLimit.count,
        windowSeconds: rateLimit.windowSeconds,
      });
      return res
        .status(429)
        .json(errorResponse({ general: ["rate_limit_exceeded"] }));
    }
  } else {
    logEvent("warn", "submit.rate_limit_skipped_no_ip", logContext, {
      status: 200,
    });
  }

  const bodyResult = await readJsonBody(req);

  if (!bodyResult.ok) {
    logEvent("warn", "submit.invalid_json_body", logContext, {
      status: 400,
    });
    return res
      .status(400)
      .json(errorResponse({ general: ["invalid_json_body"] }));
  }

  const validation = validateSubmitRequest(bodyResult.value, siteConfig);

  if (!validation.ok) {
    logEvent("warn", "submit.validation_failed", logContext, {
      status: 400,
      errorFields: Object.keys(validation.response.errors),
    });
    return res.status(400).json(validation.response);
  }

  try {
    const recaptchaSecret = decryptSecretKey(
      siteConfig.recaptcha_secret_key_encrypted
    );
    const recaptchaResult = await verifyRecaptchaToken(
      validation.value.captcha_token,
      recaptchaSecret
    );

    if (!recaptchaResult.ok) {
      const status = recaptchaResult.code === "service_unavailable" ? 503 : 400;
      logEvent("warn", "submit.recaptcha_failed", logContext, {
        status,
        code: recaptchaResult.code,
      });
      return res
        .status(status)
        .json(errorResponse({ general: [recaptchaResult.code] }));
    }
  } catch (error) {
    setCorsHeaders(res, "POST, OPTIONS", originHeader);
    logEvent("error", "submit.recaptcha_error", logContext, {
      status: 500,
      error: getErrorMessage(error),
    });
    return res
      .status(500)
      .json(errorResponse({ general: ["unexpected_error"] }));
  }

  try {
    const createdCase = await createCase({
      subject: validation.value.subject,
      description: validation.value.description,
      email: validation.value.email,
      typeId: validation.value.typeOption.id,
    });

    logEvent("info", "submit.case_created", logContext, {
      status: 201,
      caseId: createdCase.caseId,
      caseNumber: createdCase.caseNumber,
      configVersion: siteConfig.config_version,
      typeId: validation.value.typeOption.id,
    });
    return res.status(201).json({
      success: true,
      caseId: createdCase.caseId,
      caseNumber: createdCase.caseNumber,
    });
  } catch (error) {
    if (error instanceof SalesforceRequestError) {
      const status =
        error.code === "timeout"
          ? 504
          : error.code === "service_unavailable"
            ? 503
            : 500;

      logEvent("error", "submit.salesforce_error", logContext, {
        status,
        code: error.code,
        error: error.message,
      });
      return res
        .status(status)
        .json(errorResponse({ general: [error.code] }));
    }

    setCorsHeaders(res, "POST, OPTIONS", originHeader);
    logEvent("error", "submit.unexpected_error", logContext, {
      status: 500,
      error: getErrorMessage(error),
    });
    return res
      .status(500)
      .json(errorResponse({ general: ["unexpected_error"] }));
  }
}
