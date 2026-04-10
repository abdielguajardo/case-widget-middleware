declare module "@vercel/node" {
  import type { IncomingMessage, ServerResponse } from "http";

  export interface VercelRequest extends IncomingMessage {
    body?: unknown;
    query: Record<string, string | string[]>;
    cookies: Record<string, string>;
  }

  export interface VercelResponse extends ServerResponse {
    status(code: number): this;
    json(body: unknown): this;
    send(body: unknown): this;
    setHeader(name: string, value: number | string | readonly string[]): this;
  }
}
