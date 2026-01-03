#!/usr/bin/env tsx

/**
 * Scheduled Task: Send Monthly Listing Reminders
 * 
 * This script sends email reminders to all users with active listings
 * to review and refresh their listings monthly.
 * 
 * Usage with Replit Scheduled Deployments:
 * 1. Go to Publishing workspace → Scheduled Deployments
 * 2. Create new scheduled task
 * 3. Command: npx tsx send-monthly-listing-reminders.ts
 * 4. Schedule: "Run on the first day of each month at 9 AM"
 * 5. Timeout: 5 minutes
 */

async function sendListingReminders() {
  console.log('Starting monthly listing reminder emails...');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Make authenticated admin API call
    const response = await fetch(`${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/api/admin/send-listing-reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In production, you would use a service account or admin API key
        // For now, this runs with server-side privileges
      },
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API call failed: ${response.status} ${error}`);
    }

    const result = await response.json();
    
    console.log('✅ Email reminders sent successfully!');
    console.log(`Total users: ${result.totalUsers}`);
    console.log(`Emails sent: ${result.emailsSent}`);
    console.log(`Emails failed: ${result.emailsFailed}`);
    
    if (result.errors && result.errors.length > 0) {
      console.warn('Errors occurred:');
      result.errors.forEach((err: string) => console.warn(`  - ${err}`));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error sending listing reminders:', error);
    process.exit(1);
  }
}

sendListingReminders();
