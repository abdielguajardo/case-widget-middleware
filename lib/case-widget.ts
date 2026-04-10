export interface CaseWidgetTypeOption {
  id: string;
  label: string;
  value: string;
}

export interface CaseWidgetConfig {
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
  type_options: CaseWidgetTypeOption[];
}

export type SyncAction = "upsert" | "delete";

export interface SyncPayload {
  action: SyncAction;
  domain: string;
  config?: CaseWidgetConfig;
}

export type CaseWidgetConfigResponse =
  | {
      config_version: null;
      allowed: false;
      data: null;
    }
  | {
      config_version: string;
      allowed: true;
      data: {
        title: string;
        description: string;
        submit_label: string;
        cancel_label: string;
        recaptcha_use_disclosure: string;
        recaptcha: {
          siteKey: string;
        };
        form: {
          messages: {
            submit_message: string;
            success_message: string;
          };
          fields: {
            subject: {
              label: string;
            };
            type: {
              label: string;
              options: Array<{
                label: string;
                value: string;
              }>;
            };
            description: {
              label: string;
            };
            email: {
              label: string;
            };
          };
        };
      };
    };

export function buildConfigResponse(
  config: CaseWidgetConfig | null
): CaseWidgetConfigResponse {
  if (!config) {
    return {
      config_version: null,
      allowed: false,
      data: null,
    };
  }

  return {
    config_version: config.config_version,
    allowed: true,
    data: {
      title: config.title,
      description: config.description,
      submit_label: config.submit_label,
      cancel_label: config.cancel_label,
      recaptcha_use_disclosure: config.recaptcha_use_disclosure,
      recaptcha: {
        siteKey: config.recaptcha_site_key,
      },
      form: {
        messages: {
          submit_message: config.submit_message,
          success_message: config.success_message,
        },
        fields: {
          subject: {
            label: config.subject_label,
          },
          type: {
            label: config.type_label,
            options: config.type_options.map((option) => ({
              label: option.label,
              value: option.value,
            })),
          },
          description: {
            label: config.description_label,
          },
          email: {
            label: config.email_label,
          },
        },
      },
    },
  };
}
