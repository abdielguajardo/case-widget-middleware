const CASE_TYPE_FIELD_API_NAME =
  process.env.SALESFORCE_TYPE_FIELD_API_NAME?.trim() || "Type";
const SF_INSTANCE_URL = process.env.SALESFORCE_INSTANCE_URL!;
const SF_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID!;
const SF_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET!;
const SALESFORCE_API_VERSION = "v59.0";
const REQUEST_TIMEOUT_MS = 8000;

interface SalesforceTokenResponse {
  access_token: string;
  instance_url: string;
}

interface CreateCaseInput {
  subject: string;
  description: string;
  email: string;
  typeId: string;
}

interface CreatedCase {
  caseId: string;
  caseNumber: string;
}

interface CreateCaseResponse {
  id: string;
}

interface CaseRecordResponse {
  Id: string;
  CaseNumber: string;
}

export class SalesforceRequestError extends Error {
  constructor(
    public readonly code: "timeout" | "service_unavailable" | "unexpected_error",
    message: string
  ) {
    super(message);
  }
}

async function salesforceFetch(
  input: string,
  init: RequestInit
): Promise<Response> {
  try {
    return await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new SalesforceRequestError("timeout", "Salesforce request timed out");
    }

    throw new SalesforceRequestError(
      "service_unavailable",
      "Salesforce request failed"
    );
  }
}

async function getAccessToken(): Promise<SalesforceTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: SF_CLIENT_ID,
    client_secret: SF_CLIENT_SECRET,
  });

  const response = await salesforceFetch(`${SF_INSTANCE_URL}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new SalesforceRequestError(
      response.status >= 500 ? "service_unavailable" : "unexpected_error",
      `Salesforce auth failed: ${response.statusText}`
    );
  }

  return (await response.json()) as SalesforceTokenResponse;
}

async function getCaseNumber(
  instanceUrl: string,
  accessToken: string,
  caseId: string
): Promise<string> {
  const response = await salesforceFetch(
    `${instanceUrl}/services/data/${SALESFORCE_API_VERSION}/sobjects/Case/${caseId}?fields=Id,CaseNumber`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new SalesforceRequestError(
      response.status >= 500 ? "service_unavailable" : "unexpected_error",
      `Case lookup failed: ${response.statusText}`
    );
  }

  const data = (await response.json()) as CaseRecordResponse;
  return data.CaseNumber;
}

export async function createCase(payload: CreateCaseInput): Promise<CreatedCase> {
  const { access_token, instance_url } = await getAccessToken();
  const casePayload: Record<string, string> = {
    Subject: payload.subject,
    Description: payload.description,
    Origin: "Web",
    SuppliedEmail: payload.email,
    [CASE_TYPE_FIELD_API_NAME]: payload.typeId,
  };

  const response = await salesforceFetch(
    `${instance_url}/services/data/${SALESFORCE_API_VERSION}/sobjects/Case`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(casePayload),
    }
  );

  if (!response.ok) {
    throw new SalesforceRequestError(
      response.status >= 500 ? "service_unavailable" : "unexpected_error",
      `Case creation failed: ${response.statusText}`
    );
  }

  const data = (await response.json()) as CreateCaseResponse;
  const caseNumber = await getCaseNumber(instance_url, access_token, data.id);

  return {
    caseId: data.id,
    caseNumber,
  };
}
