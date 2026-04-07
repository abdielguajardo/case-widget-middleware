import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDomainConfig } from "../lib/kv";
import { createCase } from "../lib/salesforce";
import { privateDecrypt } from "crypto";

interface CaseRequest {
  subject: string;
  description: string;
  suppliedEmail: string;
  suppliedName: string;
  recaptchaToken: string;
}

async function verifyRecaptcha(
  token: string,
  secretKey: string
): Promise<boolean> {
  const response = await fetch(
    "https://www.google.com/recaptcha/api/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    }
  );

  const data = await response.json();
  return data.success === true && data.score >= 0.5;
}

function decryptSecretKey(encryptedValue: string): string {
  const privateKey = process.env.MASTER_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const encryptedBuffer = Buffer.from(encryptedValue, "base64");
  const decrypted = privateDecrypt(privateKey, encryptedBuffer);
  return decrypted.toString("utf8");
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1. Verificar origen
  const origin = req.headers["origin"] as string;

  if (!origin) {
    return res.status(400).json({ error: "Missing origin header" });
  }

  const domain = new URL(origin).hostname;

  // 2. Obtener config del dominio desde KV
  const config = await getDomainConfig(domain);

  if (!config) {
    return res.status(404).json({ error: "Domain not registered" });
  }

  if (!config.isActive) {
    return res.status(403).json({ error: "Domain inactive" });
  }

  // 3. Validar body
  const { subject, description, suppliedEmail, suppliedName, recaptchaToken } =
    req.body as CaseRequest;

  if (!subject || !description || !suppliedEmail || !recaptchaToken) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // 4. Desencriptar secret key y verificar reCAPTCHA
  try {
    const secretKey = decryptSecretKey(config.recaptchaSecretKeyEncrypted);
    const isHuman = await verifyRecaptcha(recaptchaToken, secretKey);

    if (!isHuman) {
      return res.status(403).json({ error: "reCAPTCHA validation failed" });
    }
  } catch (error) {
    console.error("Decryption/reCAPTCHA error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }

  // 5. Crear Case en Salesforce
  try {
    const caseId = await createCase({
      Subject: subject,
      Description: description,
      Origin: "Web",
      SuppliedEmail: suppliedEmail,
      SuppliedName: suppliedName,
    });

    return res
      .status(201)
      .setHeader("Access-Control-Allow-Origin", origin)
      .json({ ok: true, caseId });

  } catch (error) {
    console.error("Case creation error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}