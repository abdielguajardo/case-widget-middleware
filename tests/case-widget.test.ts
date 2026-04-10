import test from "node:test";
import assert from "node:assert/strict";
import { buildConfigResponse, CaseWidgetConfig } from "../lib/case-widget";

const sampleConfig: CaseWidgetConfig = {
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
    { id: "002", label: "Billing", value: "billing" },
  ],
};

test("buildConfigResponse returns allowed false when config is missing", () => {
  assert.deepEqual(buildConfigResponse(null), {
    config_version: null,
    allowed: false,
    data: null,
  });
});

test("buildConfigResponse maps config to widget response shape", () => {
  assert.deepEqual(buildConfigResponse(sampleConfig), {
    config_version: "v1",
    allowed: true,
    data: {
      title: "Need help?",
      description: "Describe your issue",
      submit_label: "Send",
      cancel_label: "Cancel",
      recaptcha_use_disclosure: "Protected by reCAPTCHA",
      recaptcha: {
        siteKey: "site-key",
      },
      form: {
        messages: {
          submit_message: "Sending",
          success_message: "Done",
        },
        fields: {
          subject: {
            label: "Subject",
          },
          type: {
            label: "Type",
            options: [
              { label: "Bug", value: "bug" },
              { label: "Billing", value: "billing" },
            ],
          },
          description: {
            label: "Description",
          },
          email: {
            label: "Email",
          },
        },
      },
    },
  });
});
