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
      <h1>Ready Set Fly</h1>
      <p>Monthly Listing Review Reminder</p>
    </div>
    
    <div class="content">
      <h2>Hi ${userName},</h2>
      
      <p>It's time for your monthly listing review! You currently have <strong>${totalListings} active listing${totalListings === 1 ? '' : 's'}</strong> on Ready Set Fly.</p>
      
      ${aircraftCount > 0 ? `
      <div class="listing-box">
        <h3>Aircraft Rentals: ${aircraftCount}</h3>
        <p>Keep your aircraft rental listings up to date with current availability, pricing, and maintenance status.</p>
      </div>
      ` : ''}
      
      ${marketplaceCount > 0 ? `
      <div class="listing-box">
        <h3>Marketplace Listings: ${marketplaceCount}</h3>
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

export function getBannerAdOrderEmailHtml(
  sponsorName: string, 
  orderDetails: {
    orderId: string;
    title: string;
    tier: string;
    monthlyRate: string;
    creationFee: string;
    totalAmount: string;
    grandTotal: string;
    promoCode?: string;
    discountAmount?: string;
  }
): string {
  const hasPromo = orderDetails.promoCode && parseFloat(orderDetails.discountAmount || "0") > 0;
  const discount = parseFloat(orderDetails.discountAmount || "0");
  
  // Calculate tier duration for display
  const tierDisplay = orderDetails.tier === "1month" ? "1 Month" :
                     orderDetails.tier === "3months" ? "3 Months" :
                     orderDetails.tier === "6months" ? "6 Months" :
                     "12 Months";
  
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
    .order-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 15px 0; }
    .pricing-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .pricing-label { font-weight: 500; }
    .pricing-value { font-weight: 600; }
    .discount { color: #059669; }
    .total-row { font-size: 18px; font-weight: bold; padding: 12px 0; margin-top: 10px; border-top: 2px solid #1e40af; }
    .button { display: inline-block; background: #1e40af; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 15px 0; font-weight: 600; }
    .promo-badge { background: #d1fae5; color: #047857; padding: 6px 12px; border-radius: 4px; font-weight: 600; display: inline-block; margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    .warning-box { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ready Set Fly</h1>
      <p>Banner Ad Order Confirmation</p>
    </div>
    
    <div class="content">
      <h2>Hi ${sponsorName},</h2>
      
      <p>Thank you for your interest in advertising on Ready Set Fly! We've created your banner ad order and are excited to help promote your aviation business.</p>
      
      <div class="order-box">
        <h3 style="margin-top: 0; color: #1e40af;">Order Details</h3>
        <p><strong>Campaign Title:</strong> ${orderDetails.title}</p>
        <p><strong>Duration:</strong> ${tierDisplay}</p>
        <p><strong>Monthly Rate:</strong> $${orderDetails.monthlyRate}/month</p>
        
        <div style="margin-top: 20px;">
          <h4 style="margin-bottom: 10px;">Pricing Breakdown</h4>
          <div class="pricing-row">
            <span class="pricing-label">Subscription (${tierDisplay}):</span>
            <span class="pricing-value">$${orderDetails.totalAmount}</span>
          </div>
          <div class="pricing-row">
            <span class="pricing-label">Ad Creation Fee:</span>
            <span class="pricing-value">$${orderDetails.creationFee}</span>
          </div>
          ${hasPromo ? `
          <div class="pricing-row discount">
            <span class="pricing-label">Promo Discount:</span>
            <span class="pricing-value">-$${discount.toFixed(2)}</span>
          </div>
          ` : ''}
          <div class="total-row">
            <span>Due Today:</span>
            <span>$${orderDetails.grandTotal}</span>
          </div>
        </div>
        
        ${hasPromo ? `
        <div class="promo-badge">
          Promo Code Applied: ${orderDetails.promoCode}
        </div>
        <p style="color: #047857; margin-top: 5px;">You saved $${discount.toFixed(2)} on this order!</p>
        ` : ''}
      </div>
      
      <div style="text-align: center; margin: 25px 0;">
        <p style="font-size: 16px; font-weight: 600; margin-bottom: 10px;">Ready to proceed with payment?</p>
        <a href="https://readysetfly.us/banner-ad-payment?orderId=${orderDetails.orderId}" class="button">
          View Order & Make Payment
        </a>
      </div>
      
      <div class="warning-box">
        <p style="margin: 0; font-weight: 600;">Important: Payment Required</p>
        <p style="margin: 5px 0 0 0;">Your banner ad campaign will be activated once payment is received. Please complete payment within 7 days to secure your advertising slot.</p>
      </div>
      
      <h3>What happens next?</h3>
      <ol>
        <li><strong>Complete Payment</strong> - Use the button above to view your order and submit payment via PayPal</li>
        <li><strong>Order Review</strong> - Our team will review and approve your banner ad content (usually within 1 business day)</li>
        <li><strong>Campaign Launch</strong> - Your banner ad goes live on Ready Set Fly once approved</li>
        <li><strong>Monthly Renewals</strong> - Your campaign continues monthly until you choose to cancel</li>
      </ol>
      
      <p style="margin-top: 20px;">If you have any questions or need to make changes to your order, please contact us at <a href="mailto:support@readysetfly.us">support@readysetfly.us</a>.</p>
      
      <p style="font-weight: 600;">Thank you for choosing Ready Set Fly!</p>
    </div>
    
    <div class="footer">
      <p>Ready Set Fly - Connecting Pilots with Aircraft</p>
      <p style="font-size: 12px;">You're receiving this email because a banner ad order was created for ${orderDetails.title}.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getBannerAdOrderEmailText(
  sponsorName: string,
  orderDetails: {
    orderId: string;
    title: string;
    tier: string;
    monthlyRate: string;
    creationFee: string;
    totalAmount: string;
    grandTotal: string;
    promoCode?: string;
    discountAmount?: string;
  }
): string {
  const hasPromo = orderDetails.promoCode && parseFloat(orderDetails.discountAmount || "0") > 0;
  const discount = parseFloat(orderDetails.discountAmount || "0");
  
  const tierDisplay = orderDetails.tier === "1month" ? "1 Month" :
                     orderDetails.tier === "3months" ? "3 Months" :
                     orderDetails.tier === "6months" ? "6 Months" :
                     "12 Months";
  
  return `
Hi ${sponsorName},

Thank you for your interest in advertising on Ready Set Fly! We've created your banner ad order and are excited to help promote your aviation business.

ORDER DETAILS
-------------
Campaign Title: ${orderDetails.title}
Duration: ${tierDisplay}
Monthly Rate: $${orderDetails.monthlyRate}/month

PRICING BREAKDOWN
-----------------
Subscription (${tierDisplay}): $${orderDetails.totalAmount}
Ad Creation Fee: $${orderDetails.creationFee}
${hasPromo ? `Promo Discount (${orderDetails.promoCode}): -$${discount.toFixed(2)}` : ''}
Due Today: $${orderDetails.grandTotal}

${hasPromo ? `You saved $${discount.toFixed(2)} with promo code ${orderDetails.promoCode}!\n` : ''}

READY TO PROCEED WITH PAYMENT?
View your order and make payment here:
https://readysetfly.us/banner-ad-payment?orderId=${orderDetails.orderId}

IMPORTANT: Payment Required
Your banner ad campaign will be activated once payment is received. Please complete payment within 7 days to secure your advertising slot.

WHAT HAPPENS NEXT?
1. Complete Payment - View your order and submit payment via PayPal
2. Order Review - Our team will review and approve your banner ad content (usually within 1 business day)
3. Campaign Launch - Your banner ad goes live on Ready Set Fly once approved
4. Monthly Renewals - Your campaign continues monthly until you choose to cancel

If you have any questions or need to make changes to your order, please contact us at support@readysetfly.us.

Thank you for choosing Ready Set Fly!

---
Ready Set Fly - Connecting Pilots with Aircraft
  `.trim();
}

export async function sendContactFormEmail(data: {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
}) {
  const { getUncachableResendClient } = await import('./resendClient');
  const { client: resend, fromEmail } = await getUncachableResendClient();
  
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .message-box { background: #f3f4f6; border-left: 4px solid #1e40af; padding: 15px; margin: 15px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ready Set Fly Contact Form</h1>
      <p>New Message Received</p>
    </div>
    
    <div class="content">
      <div class="info-box">
        <h3>Contact Information</h3>
        <p><strong>Name:</strong> ${data.firstName} ${data.lastName}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Subject:</strong> ${data.subject}</p>
      </div>
      
      <div class="message-box">
        <h3>Message</h3>
        <p>${data.message.replace(/\n/g, '<br>')}</p>
      </div>
      
      <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
        Reply to this message by responding to ${data.email}
      </p>
    </div>
    
    <div class="footer">
      <p>Ready Set Fly - Connecting Pilots with Aircraft</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  const textBody = `
READY SET FLY CONTACT FORM
New Message Received

CONTACT INFORMATION
-------------------
Name: ${data.firstName} ${data.lastName}
Email: ${data.email}
Subject: ${data.subject}

MESSAGE
-------
${data.message}

---
Reply to this message by responding to ${data.email}

Ready Set Fly - Connecting Pilots with Aircraft
  `.trim();
  
  try {
    await resend.emails.send({
      from: fromEmail,
      to: 'support@readysetfly.us',
      subject: `Contact Form: ${data.subject}`,
      html: htmlBody,
      text: textBody,
      replyTo: data.email,
    });
  } catch (error) {
    console.error('Failed to send contact form email:', error);
  }
}

// Banner Ad Expiration Reminder (2 days before endDate)
export function getBannerAdExpirationReminderHtml(
  sponsorName: string,
  orderDetails: {
    title: string;
    company: string;
    tier: string;
    endDate: string;
    startDate: string;
  }
): string {
  const tierDisplay = orderDetails.tier === "1month" ? "1 Month" :
                     orderDetails.tier === "3months" ? "3 Months" :
                     orderDetails.tier === "6months" ? "6 Months" :
                     "12 Months";
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .button { display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Action Required: Banner Campaign Ending Soon</h1>
    </div>
    
    <div class="content">
      <h2>Hi ${sponsorName},</h2>
      
      <div class="alert-box">
        <h3 style="margin-top: 0; color: #dc2626;">Your banner campaign ends in 2 days</h3>
        <p style="margin-bottom: 0;">Your ad will be automatically deactivated at midnight on <strong>${new Date(orderDetails.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong> and will no longer appear on Ready Set Fly.</p>
      </div>
      
      <div class="info-box">
        <h3>Campaign Summary</h3>
        <p><strong>Company:</strong> ${orderDetails.company}</p>
        <p><strong>Title:</strong> ${orderDetails.title}</p>
        <p><strong>Tier:</strong> ${tierDisplay}</p>
        <p><strong>Started:</strong> ${new Date(orderDetails.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        <p style="margin-bottom: 0;"><strong>Ends:</strong> ${new Date(orderDetails.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </div>
      
      <h3>What Happens Next?</h3>
      <p>At expiration, your banner ad will:</p>
      <ul>
        <li>Stop displaying across all placements on Ready Set Fly</li>
        <li>Be removed from the homepage, marketplace, and rental pages</li>
        <li>No longer receive impressions or clicks</li>
      </ul>
      
      <h3>Interested in Renewing?</h3>
      <p>We currently handle banner ad renewals manually. To continue your campaign:</p>
      <ul>
        <li>Reply to this email to request a renewal quote</li>
        <li>Our team will send you a new checkout link within 1 business day</li>
        <li>You can choose the same tier or upgrade to a longer duration</li>
      </ul>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="mailto:support@readysetfly.us?subject=Renewal Request for ${encodeURIComponent(orderDetails.title)}" class="button">
          Request Renewal Quote
        </a>
      </div>
      
      <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
        <strong>Note:</strong> Auto-renewal is not currently available. Please contact us before your expiration date to ensure uninterrupted ad visibility.
      </p>
      
      <div style="background: #f3f4f6; border-radius: 8px; padding: 15px; margin: 20px 0; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;"><strong>Policy Reminder:</strong> Ready Set Fly operates on a strict no-refunds policy for all banner ad campaigns. Services are available to US residents only. All fees and sales tax apply to renewed campaigns.</p>
      </div>
    </div>
    
    <div class="footer">
      <p>Ready Set Fly - Aviation Marketplace</p>
      <p style="font-size: 12px;">Questions? Contact support@readysetfly.us</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getBannerAdExpirationReminderText(
  sponsorName: string,
  orderDetails: {
    title: string;
    company: string;
    tier: string;
    endDate: string;
    startDate: string;
  }
): string {
  const tierDisplay = orderDetails.tier === "1month" ? "1 Month" :
                     orderDetails.tier === "3months" ? "3 Months" :
                     orderDetails.tier === "6months" ? "6 Months" :
                     "12 Months";
  
  return `
  const leadDays = adDetails.leadDays ?? 2;
  return `
  ACTION REQUIRED: Your Ready Set Fly banner campaign ends in ${leadDays} days
Hi ${sponsorName},

  Your banner ad will be automatically deactivated at midnight on ${new Date(adDetails.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} and will no longer appear on Ready Set Fly.

CAMPAIGN SUMMARY
----------------
Company: ${orderDetails.company}
Title: ${orderDetails.title}
Tier: ${tierDisplay}
Started: ${new Date(orderDetails.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
Ends: ${new Date(orderDetails.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

WHAT HAPPENS AT EXPIRATION?
At expiration, your banner ad will:
- Stop displaying across all placements on Ready Set Fly
- Be removed from the homepage, marketplace, and rental pages
- No longer receive impressions or clicks

INTERESTED IN RENEWING?
We currently handle banner ad renewals manually. To continue your campaign:
- Reply to this email to request a renewal quote
- Our team will send you a new checkout link within 1 business day
- You can choose the same tier or upgrade to a longer duration

Request renewal: support@readysetfly.us

Note: Auto-renewal is not currently available. Please contact us before your expiration date to ensure uninterrupted ad visibility.

POLICY REMINDER: Ready Set Fly operates on a strict no-refunds policy for all banner ad campaigns. Services are available to US residents only. All fees and sales tax apply to renewed campaigns.

Ready Set Fly - Aviation Marketplace
Questions? Contact support@readysetfly.us
  `.trim();
}

// Marketplace Listing Expiration Reminder (2 days before expiresAt)
export function getMarketplaceListingExpirationReminderHtml(
  userName: string,
  listingDetails: {
    id: string;
    title: string;
    category: string;
    tier: string;
    expiresAt: string;
  }
): string {
  const categoryDisplay = listingDetails.category === "aircraft-sale" ? "Aircraft for Sale" :
                         listingDetails.category === "charter" ? "Charter Service" :
                         listingDetails.category === "cfi" ? "CFI Instructor" :
                         listingDetails.category === "flight-school" ? "Flight School" :
                         listingDetails.category === "mechanic" ? "Mechanic Service" :
                         "Job Listing";
  
  const tierDisplay = listingDetails.tier === "basic" ? "Basic" :
                     listingDetails.tier === "standard" ? "Standard" :
                     "Premium";
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .button { display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Renew Your Listing – 2 Days Left</h1>
    </div>
    
    <div class="content">
      <h2>Hi ${userName},</h2>
      
      <div class="alert-box">
        <h3 style="margin-top: 0; color: #dc2626;">Your ${categoryDisplay} listing expires in 2 days</h3>
        <p style="margin-bottom: 0;">Your listing will be automatically hidden from search results and removed from your active listings at midnight on <strong>${new Date(listingDetails.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.</p>
      </div>
      
      <div class="info-box">
        <h3>Listing Details</h3>
        <p><strong>Title:</strong> ${listingDetails.title}</p>
        <p><strong>Category:</strong> ${categoryDisplay}</p>
        <p><strong>Tier:</strong> ${tierDisplay}</p>
        <p style="margin-bottom: 0;"><strong>Expires:</strong> ${new Date(listingDetails.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </div>
      
      <h3>What Happens at Expiration?</h3>
      <p>When your listing expires, it will:</p>
      <ul>
        <li>Be hidden from all marketplace search results</li>
        <li>No longer appear in category browsing</li>
        <li>Become inactive in your dashboard</li>
        <li>Stop receiving views and inquiries</li>
      </ul>
      
      <h3>Why Stay Active?</h3>
      <p>Active listings benefit from:</p>
      <ul>
        <li>Continuous visibility in search results</li>
        <li>Higher trust from potential buyers/clients</li>
        <li>Ongoing lead generation</li>
        <li>Professional marketplace presence</li>
      </ul>
      
      <h3>How to Renew</h3>
      <p>To renew your listing, visit your dashboard and create a new listing. You can duplicate your current listing to save time:</p>
      <ol>
        <li>Go to your Dashboard → My Listings</li>
        <li>Find your expiring listing</li>
        <li>Click "Create New Listing" to post again</li>
        <li>Select your preferred tier and complete payment</li>
      </ol>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="${process.env.REPLIT_DEV_DOMAIN || 'https://readysetfly.us'}/dashboard" class="button">
          Go to My Listings
        </a>
      </div>
      
      <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
        <strong>Need Help?</strong> Reply to this email or contact support@readysetfly.us for assistance with renewing your listing.
      </p>
      
      <div style="background: #f3f4f6; border-radius: 8px; padding: 15px; margin: 20px 0; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;"><strong>Policy Reminder:</strong> Ready Set Fly operates on a strict no-refunds policy. All marketplace fees and 8.25% sales tax apply to renewed listings. Services are available to US residents only.</p>
      </div>
    </div>
    
    <div class="footer">
      <p>Ready Set Fly - Aviation Marketplace</p>
      <p style="font-size: 12px;">Questions? Contact support@readysetfly.us</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getMarketplaceListingExpirationReminderText(
  userName: string,
  listingDetails: {
    id: string;
    title: string;
    category: string;
    tier: string;
    expiresAt: string;
    leadDays?: number;
  }
): string {
  const categoryDisplay = listingDetails.category === "aircraft-sale" ? "Aircraft for Sale" :
                         listingDetails.category === "charter" ? "Charter Service" :
                         listingDetails.category === "cfi" ? "CFI Instructor" :
                         listingDetails.category === "flight-school" ? "Flight School" :
                         listingDetails.category === "mechanic" ? "Mechanic Service" :
                         "Job Listing";
  
  const tierDisplay = listingDetails.tier === "basic" ? "Basic" :
                     listingDetails.tier === "standard" ? "Standard" :
                     "Premium";
  
  const leadDays = listingDetails.leadDays ?? 2;

  return `
RENEW YOUR LISTING – ${leadDays} DAYS LEFT

Hi ${userName},

Your ${categoryDisplay} listing expires in ${leadDays} days. Your listing will be automatically hidden from search results and removed from your active listings at midnight on ${new Date(listingDetails.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.

LISTING DETAILS
---------------
Title: ${listingDetails.title}
Category: ${categoryDisplay}
Tier: ${tierDisplay}
Expires: ${new Date(listingDetails.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

WHAT HAPPENS AT EXPIRATION?
When your listing expires, it will:
- Be hidden from all marketplace search results
- No longer appear in category browsing
- Become inactive in your dashboard
- Stop receiving views and inquiries

WHY STAY ACTIVE?
Active listings benefit from:
- Continuous visibility in search results
- Higher trust from potential buyers/clients
- Ongoing lead generation
- Professional marketplace presence

HOW TO RENEW
To renew your listing, visit your dashboard and create a new listing:
1. Go to your Dashboard → My Listings
2. Find your expiring listing
3. Click "Create New Listing" to post again
4. Select your preferred tier and complete payment

View your listings: ${process.env.REPLIT_DEV_DOMAIN || 'https://readysetfly.us'}/dashboard

Need Help? Reply to this email or contact support@readysetfly.us for assistance with renewing your listing.

POLICY REMINDER: Ready Set Fly operates on a strict no-refunds policy. All marketplace fees and 8.25% sales tax apply to renewed listings. Services are available to US residents only.

Ready Set Fly - Aviation Marketplace
Questions? Contact support@readysetfly.us
  `.trim();
}
