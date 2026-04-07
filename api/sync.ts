import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyHmacSignature } from "../lib/hmac";
import { setDomainConfig, deleteDomainConfig } from "../lib/kv";

const HMAC_SECRET = process.env.HMAC_SECRET!;

type SyncAction = "upsert" | "delete";

interface SyncPayload {
  action: SyncAction;
  domain: string;
  config?: {
    recaptchaSiteKey: string;
    recaptchaSecretKeyEncrypted: string;
    widgetConfig: Record<string, unknown>;
    rateLimitPerDay: number;
    isActive: boolean;
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1. Verificar firma HMAC
  const signature = req.headers["x-signature"] as string;

  if (!signature) {
    return res.status(401).json({ error: "Missing signature" });
  }

  const rawBody = JSON.stringify(req.body);
  const isValid = verifyHmacSignature(rawBody, signature, HMAC_SECRET);

  if (!isValid) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // 2. Parsear payload
  const { action, domain, config } = req.body as SyncPayload;

  if (!action || !domain) {
    return res.status(400).json({ error: "Missing action or domain" });
  }

  // 3. Ejecutar acción
  try {
    if (action === "upsert") {
      if (!config) {
        return res.status(400).json({ error: "Missing config for upsert" });
      }
      await setDomainConfig(domain, config);
      return res.status(200).json({ ok: true, action: "upsert", domain });
    }

    if (action === "delete") {
      await deleteDomainConfig(domain);
      return res.status(200).json({ ok: true, action: "delete", domain });
    }

    return res.status(400).json({ error: "Invalid action" });

  } catch (error) {
    console.error("Sync error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}