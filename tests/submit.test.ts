import test from "node:test";
import assert from "node:assert/strict";
import { CaseWidgetConfig } from "../lib/case-widget";
import { validateSubmitRequest } from "../lib/submit";

const config: CaseWidgetConfig = {
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
    { id: "002", label: "Billing", value: "bug" },
  ],
};

test("validateSubmitRequest trims strings and picks the first matching type value", () => {
  const result = validateSubmitRequest(
    {
      subject: "  Broken widget ",
      description: "  The widget is not loading ",
      email: "  jane@example.com ",
      type: " bug ",
      captcha_token: " token ",
      meta: {},
    },
    config
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.subject, "Broken widget");
    assert.equal(result.value.email, "jane@example.com");
    assert.equal(result.value.typeOption.id, "001");
  }
});

test("validateSubmitRequest returns structured field errors", () => {
  const result = validateSubmitRequest(
    {
      subject: " ",
      description: 42,
      email: "bad-email",
      type: "unknown",
      captcha_token: "",
      meta: null,
    },
    config
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.response, {
      success: false,
      errors: {
        subject: [{ code: "empty_subject", message: "subject must not be empty" }],
        description: [
          {
            code: "invalid_description_type",
            message: "description must be a string",
          },
        ],
        email: [{ code: "invalid_email", message: "email format is invalid" }],
        type: [{ code: "invalid_type", message: "type is not allowed for this site" }],
        general: [
          {
            code: "empty_captcha_token",
            message: "captcha_token must not be empty",
          },
          { code: "required_meta", message: "meta is required" },
        ],
      },
    });
  }
});
