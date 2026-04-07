const SF_INSTANCE_URL = process.env.SALESFORCE_INSTANCE_URL!;
const SF_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID!;
const SF_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET!;

interface SalesforceTokenResponse {
  access_token: string;
  instance_url: string;
}

interface CasePayload {
  Subject: string;
  Description: string;
  Origin: string;
  SuppliedEmail?: string;
  SuppliedName?: string;
}

async function getAccessToken(): Promise<SalesforceTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: SF_CLIENT_ID,
    client_secret: SF_CLIENT_SECRET,
  });

  const response = await fetch(
    `${SF_INSTANCE_URL}/services/oauth2/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    }
  );

  if (!response.ok) {
    throw new Error(`Salesforce auth failed: ${response.statusText}`);
  }

  return response.json();
}

export async function createCase(payload: CasePayload): Promise<string> {
  const { access_token, instance_url } = await getAccessToken();

  const response = await fetch(
    `${instance_url}/services/data/v59.0/sobjects/Case`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(`Case creation failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.id;
}