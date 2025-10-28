import paypal from "@paypal/payouts-sdk";

// Initialize PayPal environment
function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.");
  }

  // Use SandboxEnvironment for testing, LiveEnvironment for production
  // Determine environment based on presence of testing credentials or NODE_ENV
  const isProduction = process.env.NODE_ENV === "production" && 
                       !clientId.includes("sandbox") && 
                       !clientId.includes("test");

  if (isProduction) {
    return new paypal.core.LiveEnvironment(clientId, clientSecret);
  } else {
    return new paypal.core.SandboxEnvironment(clientId, clientSecret);
  }
}

// Create PayPal HTTP client
const client = new paypal.core.PayPalHttpClient(environment());

export interface PayoutRequest {
  recipientEmail: string;
  amount: number; // Amount in USD
  senderItemId: string; // Unique identifier for this payout item
  note?: string;
  emailSubject?: string;
  emailMessage?: string;
}

export interface PayoutResponse {
  success: boolean;
  batchId?: string;
  itemId?: string;
  transactionId?: string;
  transactionStatus?: string;
  error?: string;
}

/**
 * Send a payout to a single recipient using PayPal Payouts API
 */
export async function sendPayout(request: PayoutRequest): Promise<PayoutResponse> {
  try {
    const requestBody = {
      sender_batch_header: {
        sender_batch_id: `Batch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        email_subject: request.emailSubject || "You've received a payout from Ready Set Fly",
        email_message: request.emailMessage || "Your rental earnings have been sent to your PayPal account.",
        recipient_type: "EMAIL"
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            value: request.amount.toFixed(2),
            currency: "USD"
          },
          receiver: request.recipientEmail,
          sender_item_id: request.senderItemId,
          note: request.note || "Withdrawal from Ready Set Fly"
        }
      ]
    };

    const payoutRequest = new paypal.payouts.PayoutsPostRequest();
    payoutRequest.requestBody(requestBody);

    const response = await client.execute(payoutRequest);

    // Extract batch and item information
    const batchHeader = response.result.batch_header;
    const items = response.result.items || [];
    const firstItem = items[0];

    return {
      success: true,
      batchId: batchHeader.payout_batch_id,
      itemId: firstItem?.payout_item_id,
      transactionId: firstItem?.transaction_id,
      transactionStatus: firstItem?.transaction_status || batchHeader.batch_status
    };

  } catch (error: any) {
    console.error("PayPal Payout Error:", error);
    
    let errorMessage = "Failed to process payout";
    
    if (error.statusCode) {
      errorMessage += ` (Status: ${error.statusCode})`;
    }
    
    if (error.message) {
      errorMessage += `: ${error.message}`;
    }

    // Check for specific error details from PayPal
    if (error.headers && error.headers["paypal-debug-id"]) {
      errorMessage += ` [Debug ID: ${error.headers["paypal-debug-id"]}]`;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Get payout status by batch ID
 */
export async function getPayoutStatus(batchId: string): Promise<any> {
  try {
    const request = new paypal.payouts.PayoutsGetRequest(batchId);
    request.page(1);
    request.pageSize(10);
    request.totalRequired(true);

    const response = await client.execute(request);
    return {
      success: true,
      data: response.result
    };
  } catch (error: any) {
    console.error("Error fetching payout status:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch payout status"
    };
  }
}

/**
 * Cancel an unclaimed payout item
 */
export async function cancelPayoutItem(itemId: string): Promise<any> {
  try {
    const request = new paypal.payouts.PayoutsItemCancelRequest(itemId);
    const response = await client.execute(request);
    return {
      success: true,
      data: response.result
    };
  } catch (error: any) {
    console.error("Error cancelling payout:", error);
    return {
      success: false,
      error: error.message || "Failed to cancel payout"
    };
  }
}
