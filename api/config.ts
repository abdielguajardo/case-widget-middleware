import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDomainConfig } from "../lib/kv";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1. Obtener dominio del request
  const origin = req.headers["origin"] as string;

  if (!origin) {
    return res.status(400).json({ error: "Missing origin header" });
  }

  const domain = new URL(origin).hostname;

  // 2. Buscar config en KV
  try {
    const config = await getDomainConfig(domain);

    if (!config) {
      return res.status(404).json({ error: "Domain not registered" });
    }

    if (!config.isActive) {
      return res.status(403).json({ error: "Domain inactive" });
    }

    // 3. Regresar solo lo que el widget necesita
    // Nunca exponer recaptchaSecretKeyEncrypted al frontend
    return res
      .status(200)
      .setHeader("Access-Control-Allow-Origin", origin)
      .json({
        recaptchaSiteKey: config.recaptchaSiteKey,
        widgetConfig: config.widgetConfig,
      });

  } catch (error) {
    console.error("Config error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}