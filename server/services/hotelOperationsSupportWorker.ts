import { pool } from "../db";
import { getUncachableResendClient } from "../resendClient";
import { dedupeSupportRecipients, supportRetryDelayMs } from "../hotelOperationsSupportPolicy";

let timer: ReturnType<typeof setInterval> | null = null;

async function claimDueNotification() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`
      SELECT n.id, n.kind, n.attempts, c.id AS conversation_id, c.reference, c.type,
        c.first_human_response_at, c.organization_id, c.hotel_id, c.requester_account_id,
        c.created_at, a.display_name AS requester_name, o.name AS organization_name, h.name AS hotel_name
      FROM hotel_ops_support_notifications n
      JOIN hotel_ops_support_conversations c ON c.id = n.conversation_id
      JOIN hotel_ops_accounts a ON a.id = c.requester_account_id
      JOIN hotel_ops_organizations o ON o.id = c.organization_id
      LEFT JOIN hotel_ops_hotels h ON h.id = c.hotel_id
      WHERE n.status IN ('queued','retry') AND n.next_attempt_at <= now()
        AND (n.lease_expires_at IS NULL OR n.lease_expires_at < now())
      ORDER BY n.next_attempt_at FOR UPDATE OF n SKIP LOCKED LIMIT 1`);
    const job = rows[0];
    if (!job) { await client.query("COMMIT"); return null; }
    await client.query("UPDATE hotel_ops_support_notifications SET status='processing', lease_expires_at=now()+interval '2 minutes', attempts=attempts+1, updated_at=now() WHERE id=$1", [job.id]);
    await client.query("COMMIT");
    return { ...job, attempts: Number(job.attempts) + 1 };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function recipients() {
  const { rows } = await pool.query(`
    SELECT DISTINCT a.email FROM hotel_ops_accounts a
    LEFT JOIN hotel_ops_organization_memberships m ON m.account_id=a.id AND m.role='platform_owner' AND m.status='active'
    LEFT JOIN hotel_ops_support_specialists s ON s.account_id=a.id AND s.enabled=true AND s.email_notifications=true AND s.escalation_recipient=true
    WHERE a.status='active' AND (m.id IS NOT NULL OR s.id IS NOT NULL)`);
  return dedupeSupportRecipients(rows.map((row) => String(row.email)));
}

export async function processHotelOpsSupportNotificationsOnce() {
  const job = await claimDueNotification();
  if (!job) return false;
  try {
    const current = await pool.query("SELECT first_human_response_at FROM hotel_ops_support_conversations WHERE id=$1", [job.conversation_id]);
    if (!current.rows[0] || current.rows[0].first_human_response_at) {
      await pool.query("UPDATE hotel_ops_support_notifications SET status='suppressed', lease_expires_at=NULL, updated_at=now() WHERE id=$1", [job.id]);
      return true;
    }
    const to = await recipients();
    if (!to.length) throw Object.assign(new Error("no_recipients"), { code: "no_recipients" });
    const settings = await pool.query("SELECT escalation_emails_enabled FROM hotel_ops_support_settings WHERE id='platform'");
    if (settings.rows[0] && !settings.rows[0].escalation_emails_enabled) {
      await pool.query("UPDATE hotel_ops_support_notifications SET status='suppressed', lease_expires_at=NULL, updated_at=now() WHERE id=$1", [job.id]);
      return true;
    }
    const { client: emailClient, fromEmail } = await getUncachableResendClient();
    const link = `${String(process.env.FRONTEND_BASE_URL || "https://readysetfly.us").replace(/\/$/, "")}/hoteloperations/admin/support?conversation=${encodeURIComponent(job.conversation_id)}`;
    const context = `${job.organization_name}${job.hotel_name ? ` / ${job.hotel_name}` : ""}`;
    await emailClient.emails.send({ from: fromEmail, to, subject: `Unanswered Hotel Operations chat ${job.reference}`, text: `${job.requester_name} has been waiting for support in ${context}. Open the authenticated Support Center: ${link}`, html: `<p><strong>${job.requester_name}</strong> is waiting for support in ${context}.</p><p><a href="${link}">Open the authenticated Support Center</a></p><p>Message content is intentionally excluded.</p>` });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE hotel_ops_support_notifications SET status='provider_accepted', provider_accepted_at=now(), lease_expires_at=NULL, last_error_code=NULL, updated_at=now() WHERE id=$1", [job.id]);
      await client.query("UPDATE hotel_ops_support_conversations SET escalated_at=COALESCE(escalated_at,now()), updated_at=now() WHERE id=$1", [job.conversation_id]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  } catch (error: any) {
    const terminal = job.attempts >= 5;
    await pool.query("UPDATE hotel_ops_support_notifications SET status=$2, next_attempt_at=$3, lease_expires_at=NULL, last_error_code=$4, updated_at=now() WHERE id=$1", [job.id, terminal ? "failed" : "retry", new Date(Date.now() + supportRetryDelayMs(job.attempts)), String(error?.code || "email_failed").slice(0, 80)]);
  }
  return true;
}

export function startHotelOpsSupportNotificationWorker() {
  if (timer || process.env.HOTEL_OPS_SUPPORT_WORKER_DISABLED === "true") return;
  const run = async () => { try { for (let i = 0; i < 10 && await processHotelOpsSupportNotificationsOnce(); i += 1) {} } catch (error: any) { console.error(JSON.stringify({ event: "hotel_ops_support_worker_failed", code: String(error?.code || "unknown"), stage: "claim_due_notification", message: String(error?.message || "Unexpected database error").slice(0, 240) })); } };
  void run(); timer = setInterval(() => void run(), 15_000); timer.unref?.();
}
