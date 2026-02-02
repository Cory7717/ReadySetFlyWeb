const PAYPAL_API_BASE =
  process.env.PAYPAL_ENV === "production" || process.env.NODE_ENV === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing PayPal credentials");
  }
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`PayPal token error: ${res.status} ${errText}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

export async function paypalRequest(path: string, options: RequestInit = {}) {
  const token = await getPayPalAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const dataText = await res.text();
  let data: any = {};
  if (dataText) {
    try {
      data = JSON.parse(dataText);
    } catch {
      data = { raw: dataText };
    }
  }
  if (!res.ok) {
    throw new Error(data?.message || `PayPal API error ${res.status}`);
  }
  return data;
}

export function getPayPalApiBase() {
  return PAYPAL_API_BASE;
}
