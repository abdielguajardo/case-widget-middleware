import type { IncomingMessage } from "http";

type JsonBodyResult =
  | { ok: true; rawBody: string; value: unknown }
  | { ok: false };

async function readRawBody(
  req: IncomingMessage & { body?: unknown }
): Promise<string> {
  if (typeof req.body === "string") {
    return req.body;
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body.toString("utf8");
  }

  if (req.body !== undefined && req.body !== null) {
    return JSON.stringify(req.body);
  }

  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

export async function readJsonBody(
  req: IncomingMessage & { body?: unknown }
): Promise<JsonBodyResult> {
  try {
    const rawBody = await readRawBody(req);
    const value = JSON.parse(rawBody);

    return { ok: true, rawBody, value };
  } catch {
    return { ok: false };
  }
}
