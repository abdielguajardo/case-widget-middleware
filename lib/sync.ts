import { CaseWidgetConfig, CaseWidgetTypeOption, SyncPayload } from "./case-widget";

type SyncValidationResult =
  | { ok: true; value: SyncPayload & { domain: string; config?: CaseWidgetConfig } }
  | { ok: false; error: string };

function normalizeRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function validateTypeOptions(value: unknown): CaseWidgetTypeOption[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const normalizedOptions: CaseWidgetTypeOption[] = [];
  const ids = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return null;
    }

    const id = normalizeRequiredString((item as { id?: unknown }).id);
    const label = normalizeRequiredString((item as { label?: unknown }).label);
    const itemValue = normalizeRequiredString(
      (item as { value?: unknown }).value
    );

    if (!id || !label || !itemValue || ids.has(id)) {
      return null;
    }

    ids.add(id);
    normalizedOptions.push({ id, label, value: itemValue });
  }

  return normalizedOptions;
}

export function validateSyncPayload(payload: unknown): SyncValidationResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Invalid request schema" };
  }

  const input = payload as {
    action?: unknown;
    domain?: unknown;
    config?: unknown;
  };

  const action = input.action;
  const domain = normalizeRequiredString(input.domain);

  if (action !== "upsert" && action !== "delete") {
    return { ok: false, error: "Invalid action" };
  }

  if (!domain) {
    return { ok: false, error: "Missing domain" };
  }

  if (action === "delete") {
    return { ok: true, value: { action, domain } };
  }

  if (
    !input.config ||
    typeof input.config !== "object" ||
    Array.isArray(input.config)
  ) {
    return { ok: false, error: "Missing config for upsert" };
  }

  const configInput = input.config as Record<string, unknown>;
  const typeOptions = validateTypeOptions(configInput.type_options);

  if (!typeOptions) {
    return { ok: false, error: "Invalid type_options" };
  }

  const config: CaseWidgetConfig = {
    config_version: normalizeRequiredString(configInput.config_version) ?? "",
    title: normalizeRequiredString(configInput.title) ?? "",
    description: normalizeRequiredString(configInput.description) ?? "",
    submit_label: normalizeRequiredString(configInput.submit_label) ?? "",
    cancel_label: normalizeRequiredString(configInput.cancel_label) ?? "",
    recaptcha_use_disclosure:
      normalizeRequiredString(configInput.recaptcha_use_disclosure) ?? "",
    recaptcha_site_key:
      normalizeRequiredString(configInput.recaptcha_site_key) ?? "",
    recaptcha_secret_key_encrypted:
      normalizeRequiredString(configInput.recaptcha_secret_key_encrypted) ?? "",
    submit_message: normalizeRequiredString(configInput.submit_message) ?? "",
    success_message: normalizeRequiredString(configInput.success_message) ?? "",
    subject_label: normalizeRequiredString(configInput.subject_label) ?? "",
    description_label:
      normalizeRequiredString(configInput.description_label) ?? "",
    email_label: normalizeRequiredString(configInput.email_label) ?? "",
    type_label: normalizeRequiredString(configInput.type_label) ?? "",
    type_options: typeOptions,
  };

  const missingField = Object.entries(config).find(([key, value]) => {
    if (key === "type_options") {
      return false;
    }
    return value === "";
  });

  if (missingField) {
    return { ok: false, error: `Missing or invalid ${missingField[0]}` };
  }

  return {
    ok: true,
    value: {
      action,
      domain,
      config,
    },
  };
}
