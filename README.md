## 🚧 Project Status: Under Construction

> ⚠️ **This project is currently under active development.**


# case-widget-middleware

Serverless middleware for embedding a Salesforce Case creation widget on any website. Handles domain-based CORS, widget config caching, reCAPTCHA v3 verification, and RSA-encrypted credentials.

---

## Overview

This middleware acts as a secure bridge between an embeddable Case widget and a Salesforce org. It prevents direct exposure of Salesforce credentials, enforces domain-based access control, and validates reCAPTCHA tokens before creating Cases.

```
[Widget on any site] → [This middleware] → [Salesforce API]
```

---

## Architecture

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/config` | Returns widget config for the requesting domain |
| `POST` | `/api/cases` | Validates reCAPTCHA and creates a Case in Salesforce |
| `POST` | `/api/sync` | Receives webhook from Salesforce to update domain config |

### How domain config works

An admin in Salesforce registers a domain and its widget configuration. Every time a domain is added, edited, or deleted, Salesforce fires a webhook to `/api/sync`. The middleware updates its KV store accordingly.

When a widget loads on a registered domain, it calls `/api/config` — the middleware responds from cache (KV) without touching Salesforce.

### Security model

- **CORS is dynamic** — only registered domains are allowed to call the middleware
- **HMAC signature** — every webhook from Salesforce is signed; the middleware verifies it before processing
- **reCAPTCHA v3** — every Case creation is validated against Google's API
- **RSA encryption** — the reCAPTCHA secret key is stored encrypted in Salesforce and decrypted in the middleware using a private key stored only in Vercel environment variables
- **Salesforce credentials** — never exposed to the frontend; only used server-side

---

## Stack

- **Runtime**: Node.js + TypeScript
- **Platform**: Vercel (serverless functions)
- **Cache / KV**: Upstash Redis (`@upstash/redis`)
- **CRM**: Salesforce (Service Cloud)
- **Bot protection**: Google reCAPTCHA v3

---

## Project structure

```
case-widget-middleware/
├── api/
│   ├── config.ts        ← GET widget config by domain
│   ├── cases.ts         ← POST create Case in Salesforce
│   └── sync.ts          ← POST receive Salesforce webhook
├── lib/
│   ├── hmac.ts          ← HMAC signature verification
│   ├── kv.ts            ← Upstash Redis helpers
│   └── salesforce.ts    ← Salesforce REST API client
├── .env.example         ← Required environment variables template
├── vercel.json          ← Vercel function configuration
└── README.md
```

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
# Salesforce
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=
SALESFORCE_INSTANCE_URL=

# HMAC — shared secret between Salesforce and this middleware
HMAC_SECRET=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# RSA private key for decrypting reCAPTCHA secret keys
MASTER_PRIVATE_KEY=
```

---

## Salesforce setup (required)

> Salesforce setup guide coming soon.

---

## Generating required keys

### HMAC shared secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### RSA key pair

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

- `private.pem` → goes in `MASTER_PRIVATE_KEY` env var (never commit this)
- `public.pem` → goes in Salesforce Protected Custom Metadata

---

## Local development

```bash
npm install
vercel dev
```

---

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/case-widget-middleware)

Or manually:

```bash
vercel deploy
```

---

## Roadmap

- [ ] Work in progress
- [ ] Salesforce setup guide

