type BrevoEmailPayload = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
};

type BrevoClient = {
  emails: {
    send: (payload: BrevoEmailPayload) => Promise<any>;
  };
};

function parseNameEmail(value: string) {
  const match = value.match(/^(.*)<([^>]+)>$/);
  if (!match) {
    return { name: undefined, email: value.trim() };
  }
  return { name: match[1].trim(), email: match[2].trim() };
}

async function getCredentials() {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM;

  if (!apiKey) {
    throw new Error("Missing BREVO_API_KEY");
  }

  return {
    apiKey,
    fromEmail: fromEmail || "Ready Set Fly <noreply@readysetfly.us>",
  };
}

async function sendBrevoEmail(apiKey: string, payload: BrevoEmailPayload) {
  const sender = parseNameEmail(payload.from);
  const replyToValue = payload.replyTo || process.env.BREVO_REPLY_TO;
  const replyTo = replyToValue ? parseNameEmail(replyToValue) : null;
  const toList = Array.isArray(payload.to) ? payload.to : [payload.to];

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender,
      to: toList.map((email) => ({ email })),
      subject: payload.subject,
      htmlContent: payload.html,
      textContent: payload.text,
      replyTo: replyTo || undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo error ${res.status}: ${text}`);
  }

  return res.json().catch(() => ({}));
}

// WARNING: Never cache this client.
// Always call this function again to get a fresh client.
export async function getUncachableResendClient(): Promise<{ client: BrevoClient; fromEmail: string }> {
  const credentials = await getCredentials();
  return {
    client: {
      emails: {
        send: (payload: BrevoEmailPayload) => sendBrevoEmail(credentials.apiKey, payload),
      },
    },
    fromEmail: credentials.fromEmail,
  };
}
