# case-widget-middleware

> Experimental portfolio project.

This repository is an experimental serverless middleware that sits between an embeddable support widget and Salesforce. Its purpose is to showcase how I design and implement flows like:

- domain-based widget configuration
- webhook sync from Salesforce into KV
- request validation and structured API errors
- reCAPTCHA verification
- server-side secret handling
- middleware-to-Salesforce case creation
- basic operational concerns such as logging, CORS, and rate limiting

It is intentionally public as a portfolio/showcase repo, not as a finished product or production-ready template.

## What It Does

The middleware exposes three endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/config` | Returns widget config for the requesting domain |
| `POST` | `/api/submit` | Validates widget input, verifies reCAPTCHA, applies rate limit, and creates a Salesforce Case |
| `POST` | `/api/sync` | Receives a signed payload from Salesforce and updates the config cached in Upstash Redis |

High-level flow:

```text
[Widget] -> [/api/config] -> [Upstash Redis]
[Widget] -> [/api/submit] -> [reCAPTCHA] -> [Salesforce Case API]
[Salesforce] -> [/api/sync] -> [Upstash Redis]
```

## Why This Repo Exists

This project is a compact example of the kind of backend integration work I can build:

- API contract design
- middleware security boundaries
- third-party system integration
- serverless implementation on Vercel
- pragmatic TypeScript architecture for small, real-world services

The point is not to simulate a massive platform. The point is to show judgment on a small but credible workflow.

## Current Status

This repo is:

- experimental
- actively shaped as a showcase project
- suitable for demos, review, and technical discussion
- not positioned as a hardened production package

What is implemented today:

- shared `CaseWidgetConfig` contract
- domain normalization before lookup/persistence
- structured validation for submit payloads
- structured submit error responses
- HMAC validation for sync payloads
- reCAPTCHA verification
- Redis-backed config storage
- basic rate limiting on `POST /api/submit` by `domain + client IP`
- request/error logging with request context
- basic CORS handling aligned to allowed origins
- TypeScript typecheck and focused tests

What is intentionally still lightweight:

- no replay protection on `sync`
- no full integration or e2e test suite
- no advanced abuse detection beyond basic rate limit
- no full observability stack
- no deployment automation or release workflow

## API Shape

### `GET /api/config`

Returns a stable response for the widget.

If the origin is not known:

```json
{
  "config_version": null,
  "allowed": false,
  "data": null
}
```

If the origin is registered:

```json
{
  "config_version": "v1",
  "allowed": true,
  "data": {
    "title": "Need help?",
    "description": "Describe your issue",
    "submit_label": "Send",
    "cancel_label": "Cancel",
    "recaptcha_use_disclosure": "Protected by reCAPTCHA",
    "recaptcha": {
      "siteKey": "..."
    },
    "form": {
      "messages": {
        "submit_message": "Sending...",
        "success_message": "Done"
      },
      "fields": {
        "subject": { "label": "Subject" },
        "type": {
          "label": "Type",
          "options": [
            { "label": "Bug", "value": "bug" }
          ]
        },
        "description": { "label": "Description" },
        "email": { "label": "Email" }
      }
    }
  }
}
```

### `POST /api/submit`

Expected request body:

```ts
type CaseWidgetSubmitRequest = {
  subject: string;
  description: string;
  email: string;
  type: string;
  captcha_token: string;
  meta: Record<string, unknown>;
};
```

Success response:

```json
{
  "success": true,
  "caseId": "500...",
  "caseNumber": "00001024"
}
```

Error response shape:

```json
{
  "success": false,
  "errors": {
    "general": [
      {
        "code": "rate_limit_exceeded",
        "message": "too many requests for this site and IP"
      }
    ]
  }
}
```

### `POST /api/sync`

`sync` accepts:

```ts
type SyncAction = "upsert" | "delete";

type CaseWidgetConfig = {
  config_version: string;
  title: string;
  description: string;
  submit_label: string;
  cancel_label: string;
  recaptcha_use_disclosure: string;
  recaptcha_site_key: string;
  recaptcha_secret_key_encrypted: string;
  submit_message: string;
  success_message: string;
  subject_label: string;
  description_label: string;
  email_label: string;
  type_label: string;
  type_options: Array<{
    id: string;
    label: string;
    value: string;
  }>;
};

type SyncPayload = {
  action: SyncAction;
  domain: string;
  config?: CaseWidgetConfig;
};
```

The payload is signed using:

- header: `x-signature`
- algorithm: `HMAC-SHA256`
- encoding: `hex`
- content: raw request body

## Technical Notes

### Domain handling

Domains are normalized before persistence and lookup:

- trim whitespace
- lowercase
- accept hostname or full URL
- remove port
- remove trailing dot
- preserve subdomains

### `type` mapping

The widget sends `type` using the public `value`.

The middleware:

1. looks up the option by `value`
2. resolves the internal `id`
3. sends that `id` to Salesforce

The target Salesforce field is configured with:

```bash
SALESFORCE_TYPE_FIELD_API_NAME=Type
```

### Rate limiting

`POST /api/submit` is rate-limited using Upstash Redis by:

```text
domain + client IP
```

Default config:

```bash
RATE_LIMIT_WINDOW_SECONDS=600
RATE_LIMIT_MAX_REQUESTS=10
```

## Stack

- Node.js
- TypeScript
- Vercel serverless functions
- Upstash Redis
- Salesforce REST API
- Google reCAPTCHA v3

## Project Structure

```text
api/
  config.ts
  submit.ts
  sync.ts
lib/
  case-widget.ts
  cors.ts
  domain.ts
  hmac.ts
  kv.ts
  logging.ts
  rate-limit.ts
  request-body.ts
  salesforce.ts
  submit.ts
  sync.ts
tests/
types/
```

## Environment Variables

See [.env.example](./.env.example).

Current variables:

```bash
# Salesforce
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=
SALESFORCE_INSTANCE_URL=
SALESFORCE_TYPE_FIELD_API_NAME=Type

# HMAC
HMAC_SECRET=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RATE_LIMIT_WINDOW_SECONDS=600
RATE_LIMIT_MAX_REQUESTS=10

# Encryption
MASTER_PRIVATE_KEY=

# reCAPTCHA
RECAPTCHA_EXPECTED_ACTION=submit
RECAPTCHA_MIN_SCORE=0.5
```

## Local Checks

```bash
npm run typecheck
npm test
```

## Disclaimer

This is an experimental showcase repository. It demonstrates implementation patterns and engineering judgment, but it should not be treated as a drop-in production product without additional hardening, integration testing, and operational setup.
