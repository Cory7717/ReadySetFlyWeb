export function getListingReminderEmailHtml(userName: string, aircraftCount: number, marketplaceCount: number): string {
  const totalListings = aircraftCount + marketplaceCount;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .listing-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .button { display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✈️ Ready Set Fly</h1>
      <p>Monthly Listing Review Reminder</p>
    </div>
    
    <div class="content">
      <h2>Hi ${userName},</h2>
      
      <p>It's time for your monthly listing review! You currently have <strong>${totalListings} active listing${totalListings === 1 ? '' : 's'}</strong> on Ready Set Fly.</p>
      
      ${aircraftCount > 0 ? `
      <div class="listing-box">
        <h3>🛩️ Aircraft Rentals: ${aircraftCount}</h3>
        <p>Keep your aircraft rental listings up to date with current availability, pricing, and maintenance status.</p>
      </div>
      ` : ''}
      
      ${marketplaceCount > 0 ? `
      <div class="listing-box">
        <h3>🏪 Marketplace Listings: ${marketplaceCount}</h3>
        <p>Review your marketplace listings for aircraft sales, jobs, CFI services, and more.</p>
      </div>
      ` : ''}
      
      <h3>Why review your listings?</h3>
      <ul>
        <li>Update availability and pricing</li>
        <li>Refresh photos and descriptions</li>
        <li>Ensure contact information is current</li>
        <li>Remove or deactivate outdated listings</li>
        <li>Keep your profile competitive</li>
      </ul>
      
      <div style="text-align: center;">
        <a href="${process.env.REPLIT_DEV_DOMAIN || 'https://readysetfly.replit.app'}/dashboard" class="button">
          Review My Listings
        </a>
      </div>
      
      <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
        <strong>Pro Tip:</strong> Click the "Refresh" button on each listing to mark it as reviewed. This helps other users see that your listings are actively managed.
      </p>
    </div>
    
    <div class="footer">
      <p>Ready Set Fly - Connecting Pilots with Aircraft</p>
      <p style="font-size: 12px;">You're receiving this email because you have active listings on our platform.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getListingReminderEmailText(userName: string, aircraftCount: number, marketplaceCount: number): string {
  const totalListings = aircraftCount + marketplaceCount;
  
  return `
Hi ${userName},

It's time for your monthly listing review! You currently have ${totalListings} active listing${totalListings === 1 ? '' : 's'} on Ready Set Fly.

${aircraftCount > 0 ? `Aircraft Rentals: ${aircraftCount}` : ''}
${marketplaceCount > 0 ? `Marketplace Listings: ${marketplaceCount}` : ''}

Why review your listings?
- Update availability and pricing
- Refresh photos and descriptions
- Ensure contact information is current
- Remove or deactivate outdated listings
- Keep your profile competitive

Review your listings here: ${process.env.REPLIT_DEV_DOMAIN || 'https://readysetfly.replit.app'}/dashboard

Pro Tip: Click the "Refresh" button on each listing to mark it as reviewed. This helps other users see that your listings are actively managed.

Ready Set Fly - Connecting Pilots with Aircraft
  `.trim();
}
