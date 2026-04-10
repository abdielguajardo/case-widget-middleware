import type { IncomingHttpHeaders, IncomingMessage } from "http";

type LogLevel = "info" | "warn" | "error";

interface LogContext {
  requestId: string;
  method: string;
  route: string;
  path: string;
  origin?: string;
  domain?: string;
  clientIp?: string;
}

type LogFields = Record<string, unknown>;

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function getClientIp(headers: IncomingHttpHeaders): string | undefined {
  const forwardedFor = firstHeaderValue(headers["x-forwarded-for"]);

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || undefined;
  }

  return firstHeaderValue(headers["x-real-ip"]);
}

function getRequestId(headers: IncomingHttpHeaders): string {
  return (
    firstHeaderValue(headers["x-request-id"]) ||
    firstHeaderValue(headers["x-vercel-id"]) ||
    `local-${Date.now()}`
  );
}

export function buildRequestLogContext(
  req: IncomingMessage,
  route: string,
  extras: Partial<Pick<LogContext, "origin" | "domain">> = {}
): LogContext {
  return {
    requestId: getRequestId(req.headers),
    method: req.method || "UNKNOWN",
    route,
    path: req.url || route,
    clientIp: getClientIp(req.headers),
    ...extras,
  };
}

export function logEvent(
  level: LogLevel,
  event: string,
  context: LogContext,
  fields: LogFields = {}
): void {
  const entry = {
    level,
    event,
    ...context,
    ...fields,
    timestamp: new Date().toISOString(),
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
