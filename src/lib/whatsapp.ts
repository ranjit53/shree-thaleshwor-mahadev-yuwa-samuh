/**
 * WhatsApp messaging service using SendWo
 */

const sendWoApiKey = process.env.SENDWO_API_KEY;
const sendWoBaseUrl = process.env.SENDWO_BASE_URL || 'https://api.sendwo.com';
const whatsappNumber = process.env.SENDWO_WHATSAPP_NUMBER;

if (!sendWoApiKey || !whatsappNumber) {
  console.warn('SendWo WhatsApp configuration missing. Please set SENDWO_API_KEY and SENDWO_WHATSAPP_NUMBER environment variables.');
}

/**
 * Send WhatsApp message to a phone number using SendWo API
 */
export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  if (!sendWoApiKey || !whatsappNumber) {
    console.warn('SendWo WhatsApp messaging not configured');
    return false;
  }

  try {
    // Ensure phone number is in international format
    const formattedNumber = formatPhoneNumber(to);

    // SendWo API call - adjust endpoint and payload based on their documentation
    const response = await fetch(`${sendWoBaseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendWoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: formattedNumber,
        from: whatsappNumber,
        message: message,
        type: 'text'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`SendWo API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log(`WhatsApp message sent to ${formattedNumber}`, result);
    return true;
  } catch (error: any) {
    console.error('Failed to send WhatsApp message:', error.message);
    return false;
  }
}

/**
 * Format phone number to international format
 * Handles various input formats and converts to E.164 format
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Handle Nepali numbers (common in this project)
  if (cleaned.startsWith('9') && cleaned.length === 10) {
    // Assume it's a Nepali number like 9812092516 -> +9779812092516
    cleaned = '+977' + cleaned;
  } else if (cleaned.startsWith('984') && cleaned.length === 10) {
    // Nepali number without country code
    cleaned = '+977' + cleaned;
  } else if (cleaned.startsWith('974') && cleaned.length === 10) {
    // Nepali number without country code
    cleaned = '+977' + cleaned;
  } else if (cleaned.startsWith('986') && cleaned.length === 10) {
    // Nepali number without country code
    cleaned = '+977' + cleaned;
  } else if (!cleaned.startsWith('+')) {
    // If it doesn't start with +, assume it's missing country code
    // For this project, default to Nepal (+977)
    cleaned = '+977' + cleaned.replace(/^977/, '');
  }

  // Remove any double + signs
  cleaned = cleaned.replace(/^\+\+/, '+');

  return cleaned;
}

/**
 * Send loan approval notification
 */
export async function sendLoanNotification(phone: string, memberName: string, loanDetails: {
  id: string;
  principal: number;
  interestRate: number;
  termMonths: number;
  startDate: string;
}): Promise<boolean> {
  const message = `🎉 *Loan Approved - श्री थलेस्वर महादेव युवा समूह*

Dear ${memberName},

Your loan application has been approved! 

📋 *Loan Details:*
• Loan ID: ${loanDetails.id}
• Principal Amount: रू ${loanDetails.principal.toLocaleString()}
• Interest Rate: ${loanDetails.interestRate}%
• Term: ${loanDetails.termMonths} months
• Start Date: ${loanDetails.startDate}

Please contact the office for disbursement details.

*श्री थलेस्वर महादेव युवा समूह*
Thank you for choosing us! 🙏`;

  return await sendWhatsAppMessage(phone, message);
}

/**
 * Send payment receipt notification
 */
export async function sendPaymentNotification(phone: string, memberName: string, paymentDetails: {
  id: string;
  loanId: string;
  date: string;
  principalPaid: number;
  interestPaid: number;
  remarks?: string;
}): Promise<boolean> {
  const totalPaid = paymentDetails.principalPaid + paymentDetails.interestPaid;

  const message = `💰 *Payment Received - श्री थलेस्वर महादेव युवा समूह*

Dear ${memberName},

Your payment has been successfully received!

📋 *Payment Details:*
• Payment ID: ${paymentDetails.id}
• Loan ID: ${paymentDetails.loanId}
• Date: ${paymentDetails.date}
• Principal Paid: रू ${paymentDetails.principalPaid.toLocaleString()}
• Interest Paid: रू ${paymentDetails.interestPaid.toLocaleString()}
• Total Paid: रू ${totalPaid.toLocaleString()}
${paymentDetails.remarks ? `• Remarks: ${paymentDetails.remarks}` : ''}

Thank you for your timely payment! 🙏

*श्री थलेस्वर महादेव युवा समूह*`;

  return await sendWhatsAppMessage(phone, message);
}

/**
 * Send savings deposit notification
 */
export async function sendSavingsNotification(phone: string, memberName: string, savingsDetails: {
  id: string;
  date: string;
  amount: number;
  balance: number;
}): Promise<boolean> {
  const message = `💸 *Savings Deposit Confirmed - श्री थलेस्वर महादेव युवा समूह*

Dear ${memberName},

Your savings deposit has been recorded successfully!

📋 *Deposit Details:*
• Transaction ID: ${savingsDetails.id}
• Date: ${savingsDetails.date}
• Amount Deposited: रू ${savingsDetails.amount.toLocaleString()}
• Current Balance: रू ${savingsDetails.balance.toLocaleString()}

Keep saving for a brighter future! 🌟

*श्री थलेस्वर महादेव युवा समूह*`;

  return await sendWhatsAppMessage(phone, message);
}

/**
 * Send fine notification
 */
export async function sendFineNotification(phone: string, memberName: string, fineDetails: {
  id: string;
  date: string;
  amount: number;
  reason: string;
}): Promise<boolean> {
  const message = `⚠️ *Fine Applied - श्री थलेस्वर महादेव युवा समूह*

Dear ${memberName},

A fine has been applied to your account.

📋 *Fine Details:*
• Fine ID: ${fineDetails.id}
• Date: ${fineDetails.date}
• Amount: रू ${fineDetails.amount.toLocaleString()}
• Reason: ${fineDetails.reason}

Please clear the fine at the earliest to avoid additional charges.

*श्री थलेस्वर महादेव युवा समूह*`;

  return await sendWhatsAppMessage(phone, message);
}

/**
 * Send general expenditure notification (for all members or specific notification)
 */
export async function sendExpenditureNotification(phone: string, memberName: string, expenditureDetails: {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
}): Promise<boolean> {
  const message = `📊 *Group Expenditure Update - श्री थलेस्वर महादेव युवा समूह*

Dear ${memberName},

A new expenditure has been recorded in our group funds.

📋 *Expenditure Details:*
• Transaction ID: ${expenditureDetails.id}
• Date: ${expenditureDetails.date}
• Amount: रू ${expenditureDetails.amount.toLocaleString()}
• Category: ${expenditureDetails.category}
• Description: ${expenditureDetails.description}

*श्री थलेस्वर महादेव युवा समूह*
Transparency in all transactions! 🔍`;

  return await sendWhatsAppMessage(phone, message);
}
