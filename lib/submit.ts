import { CaseWidgetConfig, CaseWidgetTypeOption } from "./case-widget";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const RECAPTCHA_EXPECTED_ACTION =
  process.env.RECAPTCHA_EXPECTED_ACTION?.trim() || "submit";
const RECAPTCHA_MIN_SCORE = Number(process.env.RECAPTCHA_MIN_SCORE ?? "0.5");

export type SubmitErrorCode =
  | "required_subject"
  | "invalid_subject_type"
  | "empty_subject"
  | "subject_too_long"
  | "required_description"
  | "invalid_description_type"
  | "empty_description"
  | "description_too_long"
  | "required_email"
  | "invalid_email_type"
  | "empty_email"
  | "invalid_email"
  | "required_type"
  | "invalid_type_type"
  | "empty_type"
  | "invalid_type"
  | "required_captcha_token"
  | "invalid_captcha_token_type"
  | "empty_captcha_token"
  | "required_meta"
  | "invalid_json_body"
  | "invalid_request_schema"
  | "origin_not_allowed"
  | "site_not_found"
  | "invalid_captcha_token"
  | "invalid_captcha_action"
  | "low_captcha_score"
  | "expired_captcha_token"
  | "rate_limit_exceeded"
  | "timeout"
  | "service_unavailable"
  | "unexpected_error";

type SubmitField = "email" | "type" | "subject" | "description" | "general";
type SubmitErrors = Partial<Record<SubmitField, SubmitErrorCode[]>>;

export type SubmitErrorResponse = {
  success: false;
  errors: Partial<{
    email: Array<{ code: string; message: string }>;
    type: Array<{ code: string; message: string }>;
    subject: Array<{ code: string; message: string }>;
    description: Array<{ code: string; message: string }>;
    general: Array<{ code: string; message: string }>;
  }>;
};

interface SubmitRequest {
  subject?: unknown;
  description?: unknown;
  email?: unknown;
  type?: unknown;
  captcha_token?: unknown;
  meta?: unknown;
}

interface ValidSubmitRequest {
  subject: string;
  description: string;
  email: string;
  captcha_token: string;
  typeOption: CaseWidgetTypeOption;
}

type ValidationResult =
  | { ok: true; value: ValidSubmitRequest }
  | { ok: false; response: SubmitErrorResponse };

type RecaptchaFailureCode =
  | "invalid_captcha_token"
  | "invalid_captcha_action"
  | "low_captcha_score"
  | "expired_captcha_token"
  | "service_unavailable";

type RecaptchaVerificationResult =
  | { ok: true }
  | { ok: false; code: RecaptchaFailureCode };

const ERROR_MESSAGES: Record<SubmitErrorCode, string> = {
  required_subject: "subject is required",
  invalid_subject_type: "subject must be a string",
  empty_subject: "subject must not be empty",
  subject_too_long: "subject must be 255 characters or less",
  required_description: "description is required",
  invalid_description_type: "description must be a string",
  empty_description: "description must not be empty",
  description_too_long: "description must be 2000 characters or less",
  required_email: "email is required",
  invalid_email_type: "email must be a string",
  empty_email: "email must not be empty",
  invalid_email: "email format is invalid",
  required_type: "type is required",
  invalid_type_type: "type must be a string",
  empty_type: "type must not be empty",
  invalid_type: "type is not allowed for this site",
  required_captcha_token: "captcha_token is required",
  invalid_captcha_token_type: "captcha_token must be a string",
  empty_captcha_token: "captcha_token must not be empty",
  required_meta: "meta is required",
  invalid_json_body: "request body must be valid JSON",
  invalid_request_schema: "request body must match the expected schema",
  origin_not_allowed: "origin is not allowed",
  site_not_found: "site config was not found",
  invalid_captcha_token: "captcha token is invalid",
  invalid_captcha_action: "captcha action is invalid",
  low_captcha_score: "captcha score is too low",
  expired_captcha_token: "captcha token expired or was already used",
  rate_limit_exceeded: "too many requests for this site and IP",
  timeout: "downstream request timed out",
  service_unavailable: "downstream service is unavailable",
  unexpected_error: "unexpected internal error",
};

function addError(
  errors: SubmitErrors,
  field: SubmitField,
  code: SubmitErrorCode
): void {
  const bucket = errors[field] ?? [];
  bucket.push(code);
  errors[field] = bucket;
}

function normalizeRequiredString(
  value: unknown,
  errors: SubmitErrors,
  field: SubmitField,
  requiredCode: SubmitErrorCode,
  invalidTypeCode: SubmitErrorCode,
  emptyCode: SubmitErrorCode
): string | null {
  if (value === undefined || value === null) {
    addError(errors, field, requiredCode);
    return null;
  }

  if (typeof value !== "string") {
    addError(errors, field, invalidTypeCode);
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    addError(errors, field, emptyCode);
    return null;
  }

  return normalized;
}

function hasErrors(errors: SubmitErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function errorResponse(errors: SubmitErrors): SubmitErrorResponse {
  const responseErrors: SubmitErrorResponse["errors"] = {};

  for (const [field, codes] of Object.entries(errors) as Array<
    [SubmitField, SubmitErrorCode[]]
  >) {
    responseErrors[field] = codes.map((code) => ({
      code,
      message: ERROR_MESSAGES[code],
    }));
  }

  return {
    success: false,
    errors: responseErrors,
  };
}

export function validateSubmitRequest(
  payload: unknown,
  config: CaseWidgetConfig
): ValidationResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      response: errorResponse({ general: ["invalid_request_schema"] }),
    };
  }

  const input = payload as SubmitRequest;
  const errors: SubmitErrors = {};

  const subject = normalizeRequiredString(
    input.subject,
    errors,
    "subject",
    "required_subject",
    "invalid_subject_type",
    "empty_subject"
  );
  if (subject && subject.length > 255) {
    addError(errors, "subject", "subject_too_long");
  }

  const description = normalizeRequiredString(
    input.description,
    errors,
    "description",
    "required_description",
    "invalid_description_type",
    "empty_description"
  );
  if (description && description.length > 2000) {
    addError(errors, "description", "description_too_long");
  }

  const email = normalizeRequiredString(
    input.email,
    errors,
    "email",
    "required_email",
    "invalid_email_type",
    "empty_email"
  );
  if (email && !EMAIL_REGEX.test(email)) {
    addError(errors, "email", "invalid_email");
  }

  const selectedTypeValue = normalizeRequiredString(
    input.type,
    errors,
    "type",
    "required_type",
    "invalid_type_type",
    "empty_type"
  );

  const captchaToken = normalizeRequiredString(
    input.captcha_token,
    errors,
    "general",
    "required_captcha_token",
    "invalid_captcha_token_type",
    "empty_captcha_token"
  );

  if (input.meta === undefined || input.meta === null) {
    addError(errors, "general", "required_meta");
  } else if (typeof input.meta !== "object" || Array.isArray(input.meta)) {
    addError(errors, "general", "invalid_request_schema");
  }

  let typeOption: CaseWidgetTypeOption | undefined;
  if (selectedTypeValue) {
    typeOption = config.type_options.find(
      (option) => option.value === selectedTypeValue
    );

    if (!typeOption) {
      addError(errors, "type", "invalid_type");
    }
  }

  if (
    hasErrors(errors) ||
    !subject ||
    !description ||
    !email ||
    !captchaToken ||
    !typeOption
  ) {
    return { ok: false, response: errorResponse(errors) };
  }

  return {
    ok: true,
    value: {
      subject,
      description,
      email,
      captcha_token: captchaToken,
      typeOption,
    },
  };
}

interface RecaptchaApiResponse {
  success?: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
}

export async function verifyRecaptchaToken(
  token: string,
  secretKey: string
): Promise<RecaptchaVerificationResult> {
  let response: Response;

  try {
    response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return { ok: false, code: "service_unavailable" };
  }

  if (!response.ok) {
    return { ok: false, code: "service_unavailable" };
  }

  const data = (await response.json()) as RecaptchaApiResponse;

  if (data.success !== true) {
    if (data["error-codes"]?.includes("timeout-or-duplicate")) {
      return { ok: false, code: "expired_captcha_token" };
    }
    return { ok: false, code: "invalid_captcha_token" };
  }

  if (data.action && data.action !== RECAPTCHA_EXPECTED_ACTION) {
    return { ok: false, code: "invalid_captcha_action" };
  }

  if (typeof data.score === "number" && data.score < RECAPTCHA_MIN_SCORE) {
    return { ok: false, code: "low_captcha_score" };
  }

  return { ok: true };
}
