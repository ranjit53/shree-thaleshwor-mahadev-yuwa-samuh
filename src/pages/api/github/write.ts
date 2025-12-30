/**
 * API Route: Write JSON file to GitHub
 * This route proxies GitHub API calls to keep the token secure on the backend
 * Also triggers WhatsApp notifications for relevant data updates
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { readGitHubFile, writeGitHubFile } from '@/lib/github';
import { verifyToken } from '@/lib/auth';
import {
  sendLoanNotification,
  sendPaymentNotification,
  sendSavingsNotification,
  sendFineNotification,
  sendExpenditureNotification
} from '@/lib/whatsapp';
import { readFile } from '@/lib/api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { path, content, sha } = req.body;

  if (!path || content === undefined) {
    return res.status(400).json({ error: 'Path and content are required' });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!githubToken || !owner || !repo) {
    return res.status(500).json({ 
      error: 'GitHub configuration missing. Please set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in environment variables.' 
    });
  }

  try {
    // If sha not provided, fetch it first for updates
    let fileSha = sha;
    if (!fileSha) {
      try {
        const existing = await readGitHubFile(path, githubToken, owner, repo);
        if (existing?.sha) {
          fileSha = existing.sha;
        } else {
          // File might not exist, but we need to check by trying to get file info directly
          const checkResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            {
              headers: {
                Authorization: `token ${githubToken}`,
                Accept: 'application/vnd.github.v3+json',
              },
            }
          );
          if (checkResponse.ok) {
            const fileInfo = await checkResponse.json();
            fileSha = fileInfo.sha;
          }
        }
      } catch (e) {
        // File doesn't exist, that's fine for new files
        console.log('File may not exist, will attempt to create');
      }
    }

    // Always provide sha if file exists (required by GitHub API for updates)
    await writeGitHubFile(path, content, githubToken, owner, repo, fileSha);

    // Trigger WhatsApp notifications for data updates
    try {
      await triggerWhatsAppNotifications(path, content);
    } catch (notificationError: any) {
      console.error('WhatsApp notification error:', notificationError);
      // Don't fail the request if notifications fail
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('GitHub write error:', error);
    
    // If error is about sha (422 or 409), try to fetch current sha and retry
    if (error.message.includes('sha') || error.message.includes('422') || error.message.includes('409')) {
      try {
        // Fetch current file SHA directly from GitHub
        const checkResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
          {
            headers: {
              Authorization: `token ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );
        if (checkResponse.ok) {
          const fileInfo = await checkResponse.json();
          await writeGitHubFile(path, content, githubToken, owner, repo, fileInfo.sha);
          return res.status(200).json({ success: true });
        }
      } catch (retryError: any) {
        console.error('Retry failed:', retryError);
        // Fall through to error response
      }
    }
    
    res.status(500).json({ error: error.message || 'Failed to write file to GitHub' });
  }
}

/**
 * Trigger WhatsApp notifications based on the data being updated
 */
async function triggerWhatsAppNotifications(path: string, content: any): Promise<void> {
  // Only process JSON files
  if (!path.endsWith('.json')) return;

  try {
    const fileName = path.split('/').pop()?.replace('.json', '');

    switch (fileName) {
      case 'loans':
        await handleLoanNotifications(content);
        break;
      case 'payments':
        await handlePaymentNotifications(content);
        break;
      case 'savings':
        await handleSavingsNotifications(content);
        break;
      case 'fines':
        await handleFineNotifications(content);
        break;
      case 'expenditures':
        await handleExpenditureNotifications(content);
        break;
    }
  } catch (error: any) {
    console.error('Error triggering WhatsApp notifications:', error);
    throw error;
  }
}

/**
 * Handle loan notifications
 */
async function handleLoanNotifications(loans: any[]): Promise<void> {
  if (!Array.isArray(loans)) return;

  try {
    // Get members data to find phone numbers
    const members = await readFile('data/members.json') as any[];

    for (const loan of loans) {
      const member = members.find(m => m.id === loan.memberId);
      if (member && member.phone) {
        await sendLoanNotification(member.phone, member.name, {
          id: loan.id,
          principal: loan.principal,
          interestRate: loan.interestRate,
          termMonths: loan.termMonths,
          startDate: loan.startDate,
        });
      }
    }
  } catch (error) {
    console.error('Error sending loan notifications:', error);
  }
}

/**
 * Handle payment notifications
 */
async function handlePaymentNotifications(payments: any[]): Promise<void> {
  if (!Array.isArray(payments)) return;

  try {
    // Get members data to find phone numbers
    const members = await readFile('data/members.json') as any[];

    for (const payment of payments) {
      const member = members.find(m => m.id === payment.memberId);
      if (member && member.phone) {
        await sendPaymentNotification(member.phone, member.name, {
          id: payment.id,
          loanId: payment.loanId,
          date: payment.date,
          principalPaid: payment.principalPaid || 0,
          interestPaid: payment.interestPaid || 0,
          remarks: payment.remarks,
        });
      }
    }
  } catch (error) {
    console.error('Error sending payment notifications:', error);
  }
}

/**
 * Handle savings notifications
 */
async function handleSavingsNotifications(savings: any[]): Promise<void> {
  if (!Array.isArray(savings)) return;

  try {
    // Get members data to find phone numbers
    const members = await readFile('data/members.json') as any[];

    for (const saving of savings) {
      const member = members.find(m => m.id === saving.memberId);
      if (member && member.phone) {
        await sendSavingsNotification(member.phone, member.name, {
          id: saving.id,
          date: saving.date,
          amount: saving.amount,
          balance: saving.balance || 0,
        });
      }
    }
  } catch (error) {
    console.error('Error sending savings notifications:', error);
  }
}

/**
 * Handle fine notifications
 */
async function handleFineNotifications(fines: any[]): Promise<void> {
  if (!Array.isArray(fines)) return;

  try {
    // Get members data to find phone numbers
    const members = await readFile('data/members.json') as any[];

    for (const fine of fines) {
      const member = members.find(m => m.id === fine.memberId);
      if (member && member.phone) {
        await sendFineNotification(member.phone, member.name, {
          id: fine.id,
          date: fine.date,
          amount: fine.amount,
          reason: fine.reason,
        });
      }
    }
  } catch (error) {
    console.error('Error sending fine notifications:', error);
  }
}

/**
 * Handle expenditure notifications (notify all active members)
 */
async function handleExpenditureNotifications(expenditures: any[]): Promise<void> {
  if (!Array.isArray(expenditures)) return;

  try {
    // Get members data to find phone numbers for all active members
    const members = await readFile('data/members.json') as any[];
    const activeMembers = members.filter(m => m.active && m.phone);

    for (const expenditure of expenditures) {
      // Send notification to all active members
      for (const member of activeMembers) {
        await sendExpenditureNotification(member.phone, member.name, {
          id: expenditure.id,
          date: expenditure.date,
          amount: expenditure.amount,
          description: expenditure.description,
          category: expenditure.category,
        });
      }
    }
  } catch (error) {
    console.error('Error sending expenditure notifications:', error);
  }
}
