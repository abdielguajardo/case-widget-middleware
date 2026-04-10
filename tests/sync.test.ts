import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyHmacSignature } from "../lib/hmac";
import { validateSyncPayload } from "../lib/sync";

test("validateSyncPayload accepts a valid upsert payload", () => {
  const result = validateSyncPayload({
    action: "upsert",
    domain: " Example.com ",
    config: {
      config_version: "v1",
      title: "Need help?",
      description: "Describe your issue",
      submit_label: "Send",
      cancel_label: "Cancel",
      recaptcha_use_disclosure: "Protected by reCAPTCHA",
      recaptcha_site_key: "site-key",
      recaptcha_secret_key_encrypted: "encrypted",
      submit_message: "Sending",
      success_message: "Done",
      subject_label: "Subject",
      description_label: "Description",
      email_label: "Email",
      type_label: "Type",
      type_options: [{ id: "001", label: "Bug", value: "bug" }],
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.domain, "Example.com");
    assert.equal(result.value.config?.config_version, "v1");
  }
});

test("validateSyncPayload rejects duplicate type option ids", () => {
  const result = validateSyncPayload({
    action: "upsert",
    domain: "example.com",
    config: {
      config_version: "v1",
      title: "Need help?",
      description: "Describe your issue",
      submit_label: "Send",
      cancel_label: "Cancel",
      recaptcha_use_disclosure: "Protected by reCAPTCHA",
      recaptcha_site_key: "site-key",
      recaptcha_secret_key_encrypted: "encrypted",
      submit_message: "Sending",
      success_message: "Done",
      subject_label: "Subject",
      description_label: "Description",
      email_label: "Email",
      type_label: "Type",
      type_options: [
        { id: "001", label: "Bug", value: "bug" },
        { id: "001", label: "Billing", value: "billing" },
      ],
    },
  });

  assert.equal(result.ok, false);
});

test("verifyHmacSignature validates hex sha256 signatures", () => {
  const payload = JSON.stringify({ ok: true });
  const secret = "shhh";
  const signature = createHmac("sha256", secret).update(payload).digest("hex");

  assert.equal(verifyHmacSignature(payload, signature, secret), true);
  assert.equal(verifyHmacSignature(payload, "bad", secret), false);
});
