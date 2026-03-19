import type { LeadCategory } from "@shared/schema";

export function getListingReminderEmailHtml(userName: string, aircraftCount: number, marketplaceCount: number): string {
  const totalListings = aircraftCount + marketplaceCount;
  const dashboardUrl = process.env.APP_BASE_URL || process.env.WEB_BASE_URL || "https://readysetfly.us";
  
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
        <a href="${dashboardUrl}/dashboard" class="button">
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
  const dashboardUrl = process.env.APP_BASE_URL || process.env.WEB_BASE_URL || "https://readysetfly.us";
  
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

Review your listings here: ${dashboardUrl}/dashboard

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
        <li><strong>Complete Payment</strong> - Use the button above to view your order and submit payment via PayPal Business/Commerce, a trusted global payments platform</li>
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
1. Complete Payment - View your order and submit payment via PayPal Business/Commerce, a trusted global payments platform
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
  recipientEmail?: string;
}) {
  const { getUncachableResendClient } = await import('./resendClient');
  const { client: resend, fromEmail } = await getUncachableResendClient();
  const supportEmail = data.recipientEmail || process.env.SUPPORT_EMAIL || "support@readysetfly.us";
  
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
      to: supportEmail,
      subject: `Contact Form: ${data.subject}`,
      html: htmlBody,
      text: textBody,
      replyTo: data.email,
    });
  } catch (error) {
    console.error('Failed to send contact form email:', error);
  }
}

export async function sendBannerAdvertiserContactEmail(data: {
  sponsorEmail: string;
  sponsorName?: string | null;
  adTitle: string;
  name: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  placement?: string | null;
  category?: string | null;
}) {
  const { getUncachableResendClient } = await import('./resendClient');
  const { client: resend, fromEmail } = await getUncachableResendClient();
  const safeMessage = data.message?.trim();
  const messageHtml = safeMessage ? safeMessage.replace(/\n/g, '<br>') : "<em>No message provided.</em>";
  const messageText = safeMessage ? safeMessage : "No message provided.";
  const placementLabel = data.placement || "Not specified";
  const categoryLabel = data.category || "General";

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0f172a; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f8fafc; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .message-box { background: #f3f4f6; border-left: 4px solid #0f172a; padding: 15px; margin: 15px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ready Set Fly (RSF) Banner Ad Inquiry</h1>
      <p>Message from a Ready Set Fly visitor</p>
    </div>
    
    <div class="content">
      <p>Hi ${data.sponsorName || "Advertiser"},</p>
      <p>A Ready Set Fly visitor requested to contact you about your banner ad.</p>
      
      <div class="info-box">
        <h3>Banner Ad Details</h3>
        <p><strong>Ad:</strong> ${data.adTitle}</p>
        <p><strong>Placement:</strong> ${placementLabel}</p>
        <p><strong>Category:</strong> ${categoryLabel}</p>
      </div>
      
      <div class="info-box">
        <h3>Visitor Contact</h3>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Phone:</strong> ${data.phone || "Not provided"}</p>
      </div>
      
      <div class="message-box">
        <h3>Message</h3>
        <p>${messageHtml}</p>
      </div>
      
      <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
        Reply to this email to respond directly to ${data.email}. This lead originated on ReadySetFly.us.
      </p>
    </div>
    
    <div class="footer">
      <p>This message was sent by Ready Set Fly on behalf of ${data.name}.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
READY SET FLY BANNER AD INQUIRY

Hi ${data.sponsorName || "Advertiser"},

A Ready Set Fly visitor requested to contact you about your banner ad.

BANNER AD DETAILS
-----------------
Ad: ${data.adTitle}
Placement: ${placementLabel}
Category: ${categoryLabel}

VISITOR CONTACT
---------------
Name: ${data.name}
Email: ${data.email}
Phone: ${data.phone || "Not provided"}

MESSAGE
-------
${messageText}

---
Reply to this email to respond directly to ${data.email}.
This lead originated on ReadySetFly.us and was sent by Ready Set Fly on behalf of ${data.name}.
  `.trim();

  try {
    await resend.emails.send({
      from: fromEmail,
      to: data.sponsorEmail,
      subject: `[RSF] Banner Ad Inquiry: ${data.adTitle}`,
      html: htmlBody,
      text: textBody,
      replyTo: data.email,
    });
  } catch (error) {
    console.error("Failed to send banner advertiser contact email:", error);
    throw error;
  }
}

export async function sendMarketplaceListingContactEmail(data: {
  recipientEmail: string;
  recipientName?: string | null;
  listingId: string;
  listingTitle: string;
  listingCategory: string;
  listingLocation?: string | null;
  listingTier?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  message?: string | null;
}) {
  const { getUncachableResendClient } = await import("./resendClient");
  const { client: resend, fromEmail } = await getUncachableResendClient();
  const safeMessage = data.message?.trim();
  const messageHtml = safeMessage ? safeMessage.replace(/\n/g, "<br>") : "<em>No message provided.</em>";
  const messageText = safeMessage ? safeMessage : "No message provided.";
  const locationLabel = data.listingLocation || "Not specified";
  const tierLabel = data.listingTier || "Not specified";
  const appUrl = process.env.FRONTEND_BASE_URL || "https://readysetfly.us";

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0f172a; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f8fafc; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .message-box { background: #f3f4f6; border-left: 4px solid #0f172a; padding: 15px; margin: 15px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .cta { display: inline-block; background: #1e40af; color: #ffffff !important; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ready Set Fly Marketplace Inquiry</h1>
      <p>New message from Ready Set Fly</p>
    </div>

    <div class="content">
      <p>Hi ${data.recipientName || "Advertiser"},</p>
      <p>A Ready Set Fly visitor asked about your marketplace listing.</p>

      <div class="info-box">
        <h3>Listing Details</h3>
        <p><strong>Title:</strong> ${data.listingTitle}</p>
        <p><strong>Category:</strong> ${data.listingCategory}</p>
        <p><strong>Location:</strong> ${locationLabel}</p>
        <p><strong>Tier:</strong> ${tierLabel}</p>
        <p><strong>Listing ID:</strong> ${data.listingId}</p>
      </div>

      <div class="info-box">
        <h3>Visitor Contact</h3>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Phone:</strong> ${data.phone || "Not provided"}</p>
      </div>

      <div class="message-box">
        <h3>Message</h3>
        <p>${messageHtml}</p>
      </div>

      <div style="text-align: center; margin: 20px 0;">
        <a class="cta" href="${appUrl}/marketplace/listing/${data.listingId}">View Listing</a>
      </div>

      <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
        Reply to this email to respond directly to ${data.email}. This lead originated on ReadySetFly.us.
      </p>
    </div>

    <div class="footer">
      <p>This message was sent by Ready Set Fly on behalf of ${data.name}.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
READY SET FLY MARKETPLACE INQUIRY

Hi ${data.recipientName || "Advertiser"},

A Ready Set Fly visitor asked about your marketplace listing.

LISTING DETAILS
--------------
Title: ${data.listingTitle}
Category: ${data.listingCategory}
Location: ${locationLabel}
Tier: ${tierLabel}
Listing ID: ${data.listingId}

VISITOR CONTACT
--------------
Name: ${data.name}
Email: ${data.email}
Phone: ${data.phone || "Not provided"}

MESSAGE
-------
${messageText}

View listing: ${appUrl}/marketplace/listing/${data.listingId}

---
Reply to this email to respond directly to ${data.email}.
This lead originated on ReadySetFly.us and was sent by Ready Set Fly on behalf of ${data.name}.
  `.trim();

  try {
    await resend.emails.send({
      from: fromEmail,
      to: data.recipientEmail,
      subject: `[RSF] Marketplace Inquiry: ${data.listingTitle}`,
      html: htmlBody,
      text: textBody,
      replyTo: data.email,
    });
  } catch (error) {
    console.error("Failed to send marketplace listing contact email:", error);
    throw error;
  }
}

export async function sendWelcomeEmail(data: {
  email: string;
  firstName?: string | null;
}) {
  const { getUncachableResendClient } = await import('./resendClient');
  const { client: resend, fromEmail } = await getUncachableResendClient();
  const name = data.firstName || "pilot";
  const dashboardUrl = process.env.FRONTEND_BASE_URL || "https://readysetfly.us";

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #f3f4f6; }
    .container { max-width: 640px; margin: 0 auto; padding: 24px; }
    .card { background: white; border-radius: 12px; padding: 28px; border: 1px solid #e5e7eb; }
    h1 { font-size: 24px; margin: 0 0 8px 0; }
    h2 { font-size: 18px; margin: 20px 0 10px 0; }
    .muted { color: #6b7280; }
    .cta { display: inline-block; background: #1e40af; color: #fff !important; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    ul { padding-left: 18px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>Welcome to <strong>Ready Set Fly</strong> ✈️</h1>
      <p class="muted">Your email is verified, and you are officially cleared for takeoff.</p>
      <p>Hi ${name},</p>
      <p>I am Cory, the founder of Ready Set Fly, and I want to personally welcome you. RSF is currently in <strong>beta</strong>, and you are joining at an important moment as the platform continues to take shape with early users.</p>
      <p>Ready Set Fly was built around a simple idea: <strong>give pilots and aviation enthusiasts real utility first - then let everything else follow naturally.</strong></p>
      <p>That is why RSF focuses on practical, day-to-day aviation tools, including:</p>
      <ul>
        <li>Flight planning (routes, distance, estimated time, fuel planning)</li>
        <li>Live ATIS and airport weather</li>
        <li>Digital logbook features</li>
        <li>Training and ownership cost calculators</li>
        <li>Student and low-time pilot resources</li>
        <li>Access to current IFR approach plates</li>
      </ul>

      <p>Alongside the tools, Ready Set Fly also includes a growing <strong>aviation marketplace</strong> designed to serve the entire aviation ecosystem. Current and upcoming categories include:</p>
      <ul>
        <li>✈️ <strong>Flight schools & training programs</strong></li>
        <li>🧑‍✈️ <strong>CFIs (independent and school-affiliated)</strong></li>
        <li>🛩 <strong>Aircraft rentals</strong></li>
        <li>🚁 <strong>Charter services</strong></li>
        <li>🏷 <strong>Aircraft for sale</strong></li>
        <li>💼 <strong>Aviation jobs & career opportunities</strong></li>
        <li>🧰 <strong>Aviation services</strong> (maintenance, instruction, support)</li>
      </ul>

      <p>Since this is a new launch, we are actively building this marketplace community now - onboarding providers, refining categories, and making sure it grows in a way that genuinely serves pilots, students, and owners.</p>

      <h2>A few ways to get the most out of Ready Set Fly:</h2>
      <ul>
        <li>Start with the <strong>Flight Planner</strong> and see how it fits your workflow</li>
        <li>Explore the <strong>Student Pilot tools</strong> if you are early in training</li>
        <li>Browse the <strong>Marketplace</strong> to see what is available - and what is coming</li>
      </ul>

      <p>If you find Ready Set Fly useful, please feel free to <strong>share it with your fellow pilots, students, or aviation friends</strong>, and <strong>bookmark the site</strong> so it is easy to come back to as new tools and listings are added.</p>
      <p>Most importantly, your feedback matters here. If something feels helpful, confusing, missing, or unnecessary - just reply to this email. It comes straight to me, and early feedback is shaping the platform every day.</p>

      <div style="text-align:center; margin: 24px 0;">
        <a class="cta" href="${dashboardUrl}/dashboard">Open your dashboard</a>
      </div>

      <p>Thanks again for joining Ready Set Fly, and welcome aboard.</p>
      <p><strong>Blue skies,</strong><br><strong>Cory Armer</strong><br>Founder, Ready Set Fly ✈️</p>
    </div>
    <div class="footer">Ready Set Fly - General Aviation tools and marketplace</div>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
Welcome to Ready Set Fly ✈️

Your email is verified, and you are officially cleared for takeoff.

Hi ${name},

I am Cory, the founder of Ready Set Fly, and I want to personally welcome you. RSF is currently in beta, and you are joining at an important moment as the platform continues to take shape with early users.

Ready Set Fly was built around a simple idea:
give pilots and aviation enthusiasts real utility first - then let everything else follow naturally.

That is why RSF focuses on practical, day-to-day aviation tools, including:
- Flight planning (routes, distance, estimated time, fuel planning)
- Live ATIS and airport weather
- Digital logbook features
- Training and ownership cost calculators
- Student and low-time pilot resources
- Access to current IFR approach plates

Alongside the tools, Ready Set Fly also includes a growing aviation marketplace designed to serve the entire aviation ecosystem. Current and upcoming categories include:
- Flight schools and training programs
- CFIs (independent and school-affiliated)
- Aircraft rentals
- Charter services
- Aircraft for sale
- Aviation jobs and career opportunities
- Aviation services (maintenance, instruction, support)

Since this is a new launch, we are actively building this marketplace community now - onboarding providers, refining categories, and making sure it grows in a way that genuinely serves pilots, students, and owners.

A few ways to get the most out of Ready Set Fly:
- Start with the Flight Planner and see how it fits your workflow
- Explore the Student Pilot tools if you are early in training
- Browse the Marketplace to see what is available - and what is coming

If you find Ready Set Fly useful, please feel free to share it with your fellow pilots, students, or aviation friends, and bookmark the site so it is easy to come back to as new tools and listings are added.

Most importantly, your feedback matters here. If something feels helpful, confusing, missing, or unnecessary - just reply to this email. It comes straight to me, and early feedback is shaping the platform every day.

Open your dashboard: ${dashboardUrl}/dashboard

Thanks again for joining Ready Set Fly, and welcome aboard.

Blue skies,
Cory Armer
Founder, Ready Set Fly ✈️
  `.trim();

  try {
    await resend.emails.send({
      from: fromEmail,
      to: data.email,
      subject: "Welcome to Ready Set Fly",
      html: htmlBody,
      text: textBody,
    });
  } catch (error) {
    console.error("Failed to send welcome email:", error);
  }
}

export async function sendAdminInviteEmail(data: {
  email: string;
  inviteToken: string;
  role: string;
}) {
  const { email, inviteToken, role } = data;
  const { getUncachableResendClient } = await import('./resendClient');
  const { client: resend, fromEmail } = await getUncachableResendClient();
  const frontendBase = process.env.FRONTEND_BASE_URL || "https://readysetfly.us";
  const inviteUrl = `${frontendBase}/admin/invite?token=${encodeURIComponent(inviteToken)}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Ready Set Fly Admin Invite</h2>
      <p>You have been invited to join the Ready Set Fly team as a <strong>${role}</strong>.</p>
      <p>Click the button below to create your account and accept the invite:</p>
      <p style="margin: 24px 0;">
        <a href="${inviteUrl}" style="background:#1e40af;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">Accept Invite</a>
      </p>
      <p>If you already have an account with this email, log in first and then open the invite link.</p>
      <p style="font-size:12px;color:#6b7280;">If you did not expect this invite, you can ignore this email.</p>
    </div>
  `;

  const text = `Ready Set Fly Admin Invite\n\nYou have been invited as ${role}.\nAccept invite: ${inviteUrl}\n\nIf you did not expect this invite, ignore this email.`;

  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "Ready Set Fly Admin Invite",
    html,
    text,
  });
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
  adDetails: {
    title: string;
    company: string;
    tier: string;
    endDate: string;
    startDate: string;
    leadDays?: number;
  }
): string {
  const tierDisplay = adDetails.tier === "1month" ? "1 Month" :
                     adDetails.tier === "3months" ? "3 Months" :
                     adDetails.tier === "6months" ? "6 Months" :
                     "12 Months";
  const leadDays = adDetails.leadDays ?? 2;
  
  return `
ACTION REQUIRED: Your Ready Set Fly banner campaign ends in ${leadDays} days

Hi ${sponsorName},

Your banner ad will be automatically deactivated at midnight on ${new Date(adDetails.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} and will no longer appear on Ready Set Fly.

CAMPAIGN SUMMARY
----------------
Company: ${adDetails.company}
Title: ${adDetails.title}
Tier: ${tierDisplay}
Started: ${new Date(adDetails.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
Ends: ${new Date(adDetails.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

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
  const dashboardUrl = process.env.APP_BASE_URL || process.env.WEB_BASE_URL || "https://readysetfly.us";
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
        <a href="${dashboardUrl}/dashboard" class="button">
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
  const dashboardUrl = process.env.APP_BASE_URL || process.env.WEB_BASE_URL || "https://readysetfly.us";
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

View your listings: ${dashboardUrl}/dashboard

Need Help? Reply to this email or contact support@readysetfly.us for assistance with renewing your listing.

POLICY REMINDER: Ready Set Fly operates on a strict no-refunds policy. All marketplace fees and 8.25% sales tax apply to renewed listings. Services are available to US residents only.

Ready Set Fly - Aviation Marketplace
Questions? Contact support@readysetfly.us
  `.trim();
}

export function getLogbookProAlertEmailHtml(data: {
  firstName: string;
  title: string;
  message: string;
  dueDate: Date;
}): string {
  const dueDate = data.dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #f3f4f6; }
    .container { max-width: 640px; margin: 0 auto; padding: 24px; }
    .card { background: white; border-radius: 12px; padding: 28px; border: 1px solid #e5e7eb; }
    .header { background: #1e40af; color: #fff; padding: 18px 24px; border-radius: 10px; }
    .cta { display: inline-block; background: #1e40af; color: #fff !important; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .muted { color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h2 style="margin:0;">RSF Pro Alert</h2>
      </div>
      <p style="margin-top: 20px;">Hi ${data.firstName},</p>
      <p><strong>${data.title}</strong></p>
      <p>${data.message}</p>
      <p class="muted">Due date: ${dueDate}</p>
      <div style="margin-top: 20px;">
        <a class="cta" href="${process.env.FRONTEND_BASE_URL || "https://readysetfly.us"}/logbook">
          Review in RSF Pro
        </a>
      </div>
      <p class="muted" style="margin-top: 20px;">You’re receiving this email because RSF Pro alerts are enabled on your account.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getLogbookProAlertEmailText(data: {
  firstName: string;
  title: string;
  message: string;
  dueDate: Date;
}): string {
  const dueDate = data.dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return `
RSF Pro Alert

Hi ${data.firstName},

${data.title}
${data.message}

Due date: ${dueDate}

Review in RSF Pro: ${(process.env.FRONTEND_BASE_URL || "https://readysetfly.us")}/logbook

You’re receiving this email because RSF Pro alerts are enabled on your account.
  `.trim();
}

export function getWeeklyEngagementEmailHtml(data: {
  firstName: string;
  unsubscribeUrl: string;
}): string {
  const appUrl = process.env.FRONTEND_BASE_URL || "https://readysetfly.us";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #f3f4f6; }
    .container { max-width: 640px; margin: 0 auto; padding: 24px; }
    .card { background: white; border-radius: 12px; padding: 28px; border: 1px solid #e5e7eb; }
    .header { background: #1e40af; color: #fff; padding: 18px 24px; border-radius: 10px; }
    .cta { display: inline-block; background: #1e40af; color: #fff !important; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .muted { color: #6b7280; font-size: 12px; }
    .list { margin: 16px 0; padding-left: 18px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h2 style="margin:0;">Your Weekly Pilot Tools Rundown</h2>
      </div>
      <p style="margin-top: 20px;">Hi ${data.firstName},</p>
      <p>We saved a few quick wins to help you plan safer, faster flights this week:</p>
      <ul class="list">
        <li>Build a new route and get a risk summary in the Flight Planner.</li>
        <li>Check live weather layers before your next departure.</li>
        <li>Keep your logbook and currency alerts up to date.</li>
      </ul>
      <div style="margin-top: 18px;">
        <a class="cta" href="${appUrl}/flight-planner">Open the Flight Planner</a>
      </div>
      <p class="muted" style="margin-top: 20px;">
        You are receiving this weekly email because you have an account with Ready Set Fly.
        <a href="${data.unsubscribeUrl}">Unsubscribe</a>.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getWeeklyEngagementEmailText(data: {
  firstName: string;
  unsubscribeUrl: string;
}): string {
  const appUrl = process.env.FRONTEND_BASE_URL || "https://readysetfly.us";
  return `
Weekly Pilot Tools Rundown

Hi ${data.firstName},

Plan safer flights this week:
- Build a new route and get a risk summary in the Flight Planner.
- Check live weather layers before your next departure.
- Keep your logbook and currency alerts up to date.

Open the Flight Planner: ${appUrl}/flight-planner

Unsubscribe: ${data.unsubscribeUrl}
  `.trim();
}

export function getProTrialOfferEmailHtml(data: {
  firstName: string;
  unsubscribeUrl: string;
}): string {
  const appUrl = process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || process.env.WEB_BASE_URL || "https://readysetfly.us";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #eef2ff; }
    .container { max-width: 640px; margin: 0 auto; padding: 24px; }
    .card { background: #ffffff; border-radius: 12px; padding: 28px; border: 1px solid #cbd5e1; }
    .header { background: linear-gradient(135deg, #1d4ed8, #1e3a8a); color: #fff; padding: 20px 24px; border-radius: 10px; }
    .cta { display: inline-block; background: #1d4ed8; color: #fff !important; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 700; }
    .list { margin: 16px 0; padding-left: 18px; }
    .note { font-size: 12px; color: #64748b; margin-top: 20px; }
    .pill { display: inline-block; margin-top: 12px; padding: 6px 10px; border-radius: 999px; border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="pill">14-day Pro trial</div>
        <h2 style="margin: 12px 0 0 0;">Try RSF Pro free for 14 days</h2>
      </div>
      <p style="margin-top: 20px;">Hi ${data.firstName},</p>
      <p>Ready Set Fly now includes a 14-day free trial on the monthly RSF Pro plan. If you have been browsing the marketplace, planning flights, or using the training tools, this is the easiest way to try the full workflow.</p>
      <ul class="list">
        <li>Save flight plans and aircraft profiles.</li>
        <li>Keep your digital logbook, endorsements, and training history in one place.</li>
        <li>Track currency and continue working across planning and training tools.</li>
      </ul>
      <p>RSF is built to make general aviation easier to navigate — from rentals and instructors to planning and tracking tools in one place.</p>
      <div style="margin-top: 18px;">
        <a class="cta" href="${appUrl}/logbook-pro">Start your 14-day trial</a>
      </div>
      <p class="note">
        Monthly plans start at $5.99 after the free trial. Cancel any time before renewal.
        <a href="${data.unsubscribeUrl}">Unsubscribe</a>.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getProTrialOfferEmailText(data: {
  firstName: string;
  unsubscribeUrl: string;
}): string {
  const appUrl = process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || process.env.WEB_BASE_URL || "https://readysetfly.us";
  return `
Try RSF Pro free for 14 days

Hi ${data.firstName},

Ready Set Fly now includes a 14-day free trial on the monthly RSF Pro plan.

Try the full workflow:
- Save flight plans and aircraft profiles
- Keep your digital logbook and training history in one place
- Track currency and continue working across planning and training tools

Start your trial: ${appUrl}/logbook-pro

Monthly plans start at $5.99 after the free trial. Cancel any time before renewal.
Unsubscribe: ${data.unsubscribeUrl}
  `.trim();
}

type CrmSalesEmailTemplateData = {
  firstName: string;
  company?: string | null;
  unsubscribeUrl: string;
};

type CrmSalesEmailConfig = {
  subject: string;
  headline: string;
  intro: string;
  bullets: string[];
  ctaLabel: string;
  ctaUrl: string;
  browseUrl?: string;
  browseLabel?: string;
};

const CRM_SALES_EMAIL_CONFIG: Record<LeadCategory, CrmSalesEmailConfig> = {
  aircraft_sales: {
    subject: "List your aircraft on Ready Set Fly",
    headline: "Put your aircraft listing in front of active pilots",
    intro: "Ready Set Fly gives aircraft sellers a direct way to showcase inventory, photos, specs, and contact details in one place.",
    bullets: [
      "Highlight aircraft details and photos in a dedicated listing",
      "Reach pilots and buyers already browsing aviation inventory",
      "Make it easy for interested buyers to contact your team",
    ],
    ctaLabel: "Create Aircraft Listing",
    ctaUrl: "/create-marketplace-listing",
    browseLabel: "View aircraft listings",
    browseUrl: "/marketplace?category=aircraft-sale",
  },
  aviation_jobs: {
    subject: "Post your aviation jobs on Ready Set Fly",
    headline: "Reach aviation talent from one marketplace listing",
    intro: "Use Ready Set Fly to publish aviation openings and connect with pilots, mechanics, and support staff already using the platform.",
    bullets: [
      "Share job details, location, and application instructions",
      "Reach aviation professionals searching for their next role",
      "Keep your openings visible in a category built for aviation employers",
    ],
    ctaLabel: "Post Aviation Job",
    ctaUrl: "/create-marketplace-listing",
    browseLabel: "View aviation jobs",
    browseUrl: "/marketplace?category=job",
  },
  flight_schools: {
    subject: "List your flight school on Ready Set Fly",
    headline: "Showcase your flight school to Ready Set Fly pilots",
    intro: "Create a marketplace listing for your flight school so prospective students can find your programs, location, and contact information quickly.",
    bullets: [
      "Promote discovery flights, training programs, and school details",
      "Give future students a single place to learn about your operation",
      "Capture inbound interest from pilots already browsing the marketplace",
    ],
    ctaLabel: "List Flight School",
    ctaUrl: "/create-marketplace-listing",
    browseLabel: "View flight schools",
    browseUrl: "/marketplace?category=flight-school",
  },
  rentals: {
    subject: "List your aircraft rental on Ready Set Fly",
    headline: "Put your rental aircraft in front of verified pilots",
    intro: "Ready Set Fly helps rental operators present aircraft availability, pricing, and contact details to pilots looking for their next booking.",
    bullets: [
      "Create a dedicated rental listing with aircraft details and photos",
      "Reach pilots searching for rental options on the platform",
      "Keep inquiries and listing information in one workflow",
    ],
    ctaLabel: "List Rental Aircraft",
    ctaUrl: "/list-aircraft",
    browseLabel: "Browse rental marketplace",
    browseUrl: "/rentals",
  },
  cfi_services: {
    subject: "List your CFI services on Ready Set Fly",
    headline: "Promote your instruction services to active students and pilots",
    intro: "Ready Set Fly lets instructors publish their services, ratings, and home base so pilots can find the right fit faster.",
    bullets: [
      "Highlight ratings, specialties, and service area",
      "Create a profile that students can find from the marketplace and CFI directory",
      "Give pilots a simple way to reach out and book interest",
    ],
    ctaLabel: "List CFI Services",
    ctaUrl: "/create-marketplace-listing",
    browseLabel: "View CFI listings",
    browseUrl: "/marketplace?category=cfi",
  },
  charter_services: {
    subject: "List your charter company on Ready Set Fly",
    headline: "Showcase your charter service where pilots and travelers are browsing",
    intro: "Create a charter marketplace listing that makes your fleet, service area, and contact details easy to discover on Ready Set Fly.",
    bullets: [
      "Feature your charter company in a dedicated aviation marketplace category",
      "Share fleet highlights, service area, and contact information",
      "Turn marketplace traffic into qualified charter inquiries",
    ],
    ctaLabel: "List Charter Company",
    ctaUrl: "/create-marketplace-listing",
    browseLabel: "View charter listings",
    browseUrl: "/marketplace?category=charter",
  },
  mechanic_services: {
    subject: "List your mechanic services on Ready Set Fly",
    headline: "Help aircraft owners find your maintenance services",
    intro: "Ready Set Fly gives mechanics and maintenance shops a straightforward listing page to highlight services, location, and contact information.",
    bullets: [
      "Promote your maintenance specialties and service area",
      "Reach owners and operators looking for trusted support",
      "Keep your business visible in a mechanic-specific marketplace category",
    ],
    ctaLabel: "List Mechanic Services",
    ctaUrl: "/create-marketplace-listing",
    browseLabel: "View mechanic listings",
    browseUrl: "/marketplace?category=mechanic",
  },
  banner_ads: {
    subject: "Advertise your aviation business on Ready Set Fly",
    headline: "Promote your brand across the Ready Set Fly audience",
    intro: "Banner campaigns on Ready Set Fly put your business in front of pilots across the marketplace, directory, and tool surfaces.",
    bullets: [
      "Choose placements that match the audience you want to reach",
      "Use branded artwork or video to promote offers and awareness",
      "Add a measurable marketing channel focused on aviation users",
    ],
    ctaLabel: "View Advertising Options",
    ctaUrl: "/banner-advertise",
  },
  marketplace_services: {
    subject: "List your aviation service on Ready Set Fly",
    headline: "Add your service business to the Ready Set Fly marketplace",
    intro: "If your business serves pilots or aircraft owners, a marketplace listing is the fastest way to get in front of the right audience on Ready Set Fly.",
    bullets: [
      "Create a focused listing around the service you offer",
      "Keep business details, contact info, and description in one place",
      "Turn marketplace discovery into qualified inbound leads",
    ],
    ctaLabel: "Create Service Listing",
    ctaUrl: "/create-marketplace-listing",
    browseLabel: "Open marketplace",
    browseUrl: "/marketplace",
  },
  sponsorships: {
    subject: "Sponsor Ready Set Fly and reach more pilots",
    headline: "Put your aviation brand in front of the Ready Set Fly audience",
    intro: "Ready Set Fly sponsorships help aviation businesses build awareness across high-intent surfaces where pilots already spend time.",
    bullets: [
      "Explore sponsor placements across marketplace and tool pages",
      "Position your brand alongside aviation-focused content and listings",
      "Create a repeatable way to reach active pilots and operators",
    ],
    ctaLabel: "Explore Sponsorship Options",
    ctaUrl: "/banner-advertise",
  },
  other: {
    subject: "Promote your aviation business on Ready Set Fly",
    headline: "Get your business in front of the Ready Set Fly audience",
    intro: "Ready Set Fly helps aviation businesses create visibility with listings and advertising options built for pilots, students, and operators.",
    bullets: [
      "Create a listing or promotion that matches your business model",
      "Reach aviation users already browsing for services and opportunities",
      "Keep your contact details and offer visible in one place",
    ],
    ctaLabel: "Explore Ready Set Fly",
    ctaUrl: "/marketplace",
  },
};

function getMarketingAppUrl() {
  return process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || process.env.WEB_BASE_URL || "https://readysetfly.us";
}

function getCrmSalesEmailConfig(category: LeadCategory): CrmSalesEmailConfig {
  return CRM_SALES_EMAIL_CONFIG[category] ?? CRM_SALES_EMAIL_CONFIG.other;
}

function getRecipientName(firstName: string, company?: string | null) {
  return firstName?.trim() || company?.trim() || "there";
}

export function getCrmLeadSalesEmailSubject(category: LeadCategory): string {
  return getCrmSalesEmailConfig(category).subject;
}

export function getCrmLeadSalesEmailHtml(
  category: LeadCategory,
  data: CrmSalesEmailTemplateData,
): string {
  const appUrl = getMarketingAppUrl();
  const config = getCrmSalesEmailConfig(category);
  const recipientName = getRecipientName(data.firstName, data.company);
  const ctaUrl = `${appUrl}${config.ctaUrl}`;
  const browseUrl = config.browseUrl ? `${appUrl}${config.browseUrl}` : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #f3f4f6; }
    .container { max-width: 640px; margin: 0 auto; padding: 24px; }
    .card { background: #ffffff; border-radius: 12px; padding: 28px; border: 1px solid #e5e7eb; }
    .header { background: linear-gradient(135deg, #0f172a, #1d4ed8); color: #ffffff; border-radius: 10px; padding: 20px 24px; }
    .cta { display: inline-block; background: #1d4ed8; color: #ffffff !important; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 700; }
    .secondary { display: inline-block; margin-top: 12px; color: #1d4ed8; text-decoration: none; font-weight: 600; }
    .list { margin: 16px 0; padding-left: 18px; }
    .note { margin-top: 22px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h2 style="margin: 0;">${config.headline}</h2>
      </div>
      <p style="margin-top: 20px;">Hi ${recipientName},</p>
      <p>${config.intro}</p>
      <ul class="list">
        ${config.bullets.map((bullet) => `<li>${bullet}</li>`).join("")}
      </ul>
      <div style="margin-top: 20px;">
        <a class="cta" href="${ctaUrl}">${config.ctaLabel}</a>
      </div>
      ${browseUrl && config.browseLabel ? `<div><a class="secondary" href="${browseUrl}">${config.browseLabel}</a></div>` : ""}
      <p style="margin-top: 20px;">If you would rather not receive sales emails from Ready Set Fly, you can <a href="${data.unsubscribeUrl}">unsubscribe</a>.</p>
      <p class="note">
        This message was sent because your business was added as a CRM lead for Ready Set Fly.<br />
        <a href="${data.unsubscribeUrl}">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getCrmLeadSalesEmailText(
  category: LeadCategory,
  data: CrmSalesEmailTemplateData,
): string {
  const appUrl = getMarketingAppUrl();
  const config = getCrmSalesEmailConfig(category);
  const recipientName = getRecipientName(data.firstName, data.company);
  const ctaUrl = `${appUrl}${config.ctaUrl}`;
  const browseLine = config.browseUrl && config.browseLabel
    ? `\n${config.browseLabel}: ${appUrl}${config.browseUrl}`
    : "";

  return `
${config.headline}

Hi ${recipientName},

${config.intro}

${config.bullets.map((bullet) => `- ${bullet}`).join("\n")}

${config.ctaLabel}: ${ctaUrl}${browseLine}

If you would rather not receive sales emails from Ready Set Fly, unsubscribe here:
${data.unsubscribeUrl}
  `.trim();
}


