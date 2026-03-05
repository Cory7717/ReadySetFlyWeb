import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { personalFinanceEntries } from "@shared/schema";
import { getUncachableResendClient } from "../resendClient";

const CORY_EMAIL = "coryarmer@gmail.com";
const AMY_EMAIL = "bentley.amy24@gmail.com";

function resolveRecipients(owner: string): string[] {
  if (owner === "cory") return [CORY_EMAIL];
  if (owner === "amy") return [AMY_EMAIL];
  return [CORY_EMAIL, AMY_EMAIL];
}

function toDateOnly(dateValue: Date): Date {
  return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
}

function parseEntryDueDate(dueDate: string | null): Date | null {
  if (!dueDate) return null;
  const parsed = new Date(`${dueDate}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatUsd(amount: string | number | null | undefined): string {
  const value = Number(amount || 0);
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDueDateLabel(dateValue: Date): string {
  return dateValue.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function resolveGreeting(owner: string): string {
  if (owner === "cory") return "Cory";
  if (owner === "amy") return "Amy";
  return "Cory & Amy";
}

export async function runFinanceAlerts(): Promise<{ considered: number; sent: number }> {
  const candidates = await db
    .select()
    .from(personalFinanceEntries)
    .where(
      and(
        eq(personalFinanceEntries.isPaid, false),
        eq(personalFinanceEntries.notificationSent, false),
        isNotNull(personalFinanceEntries.dueDate),
      ),
    );

  if (!candidates.length) {
    return { considered: 0, sent: 0 };
  }

  const today = toDateOnly(new Date());
  const appBaseUrl = (process.env.WEB_ORIGIN || "https://readysetfly.us").split(",")[0].trim();
  const { client: resend, fromEmail } = await getUncachableResendClient();
  let sentCount = 0;

  for (const entry of candidates) {
    const dueDate = parseEntryDueDate(entry.dueDate);
    if (!dueDate) continue;

    const notifyDays = Math.max(0, Number(entry.notifyDaysBefore ?? 3));
    const notifyOnOrBefore = new Date(today);
    notifyOnOrBefore.setDate(today.getDate() + notifyDays);
    if (dueDate > notifyOnOrBefore) {
      continue;
    }

    const recipients = resolveRecipients(entry.owner);
    const amountFormatted = formatUsd(entry.amount);
    const dueDateLabel = formatDueDateLabel(dueDate);
    const subject = `Bill Due Soon: ${entry.subcategory || entry.category} — $${amountFormatted} due ${dueDateLabel}`;
    const greeting = resolveGreeting(entry.owner);
    const rsfLine = entry.rsfCategory ? `RSF Category: ${entry.rsfCategory}` : "";
    const text = [
      `Hi ${greeting},`,
      "",
      `Your ${entry.subcategory || entry.category} bill of $${amountFormatted} is due on ${dueDateLabel}.`,
      `Category: ${entry.category}`,
      rsfLine,
      "",
      `Log in to mark it paid: ${appBaseUrl}/admin`,
      "",
      "— RSF Finance Tracker",
    ]
      .filter(Boolean)
      .join("\n");

    const html = `
      <p>Hi ${greeting},</p>
      <p>Your <strong>${entry.subcategory || entry.category}</strong> bill of <strong>$${amountFormatted}</strong> is due on <strong>${dueDateLabel}</strong>.</p>
      <p>Category: ${entry.category}</p>
      ${entry.rsfCategory ? `<p>RSF Category: ${entry.rsfCategory}</p>` : ""}
      <p><a href="${appBaseUrl}/admin">Log in to mark it paid</a></p>
      <p>— RSF Finance Tracker</p>
    `;

    try {
      await resend.emails.send({
        from: fromEmail,
        to: recipients,
        subject,
        text,
        html,
      });

      await db
        .update(personalFinanceEntries)
        .set({ notificationSent: true, updatedAt: new Date() })
        .where(eq(personalFinanceEntries.id, entry.id));
      sentCount += 1;
    } catch (error) {
      console.error("Finance alert email failed", { entryId: entry.id, error });
    }
  }

  return { considered: candidates.length, sent: sentCount };
}

let financeAlertInterval: NodeJS.Timeout | null = null;
let lastFinanceAlertRunDate = "";

export function startFinanceAlertsJob() {
  if (financeAlertInterval) return;

  const maybeRun = async () => {
    const now = new Date();
    const runDate = now.toISOString().slice(0, 10);
    const isRunWindow = now.getHours() === 8 && now.getMinutes() < 15;
    if (!isRunWindow || lastFinanceAlertRunDate === runDate) return;

    lastFinanceAlertRunDate = runDate;
    try {
      const result = await runFinanceAlerts();
      console.log(
        JSON.stringify({
          event: "finance_alerts",
          considered: result.considered,
          sent: result.sent,
          runDate,
        }),
      );
    } catch (error) {
      console.error("Finance alerts job failed", error);
    }
  };

  financeAlertInterval = setInterval(() => {
    void maybeRun();
  }, 15 * 60 * 1000);

  if (String(process.env.FINANCE_ALERTS_RUN_ON_START || "").toLowerCase() === "true") {
    void runFinanceAlerts().catch((error) => {
      console.error("Finance alerts initial run failed", error);
    });
  }
}

