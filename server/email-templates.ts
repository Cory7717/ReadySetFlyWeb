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
        <a href="${process.env.REPLIT_DEV_DOMAIN || 'https://readysetfly.us'}/banner-ad-payment?orderId=${orderDetails.orderId}" class="button">
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
${process.env.REPLIT_DEV_DOMAIN || 'https://readysetfly.us'}/banner-ad-payment?orderId=${orderDetails.orderId}

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
