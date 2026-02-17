#!/usr/bin/env tsx

/**
 * Scheduled Task: Send Weekly Engagement Emails
 *
 * Usage with scheduled deployments:
 * - Command: npx tsx send-weekly-engagement-emails.ts
 * - Schedule: Weekly (e.g., Mondays at 9 AM)
 */

async function sendWeeklyEngagementEmails() {
  console.log("Starting weekly engagement emails...");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  try {
    const baseUrl = process.env.REPLIT_DEV_DOMAIN || "http://localhost:5000";
    const cronSecret = process.env.CRON_SECRET || process.env.SESSION_SECRET || "";

    const response = await fetch(`${baseUrl}/api/cron/send-weekly-engagement`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API call failed: ${response.status} ${error}`);
    }

    const result = await response.json();
    console.log("✅ Weekly emails sent successfully!");
    console.log(`Candidates: ${result.totalCandidates}`);
    console.log(`Emails sent: ${result.emailsSent}`);

    if (result.errors && result.errors.length > 0) {
      console.warn("Errors occurred:");
      result.errors.forEach((err: string) => console.warn(`  - ${err}`));
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error sending weekly engagement emails:", error);
    process.exit(1);
  }
}

sendWeeklyEngagementEmails();
