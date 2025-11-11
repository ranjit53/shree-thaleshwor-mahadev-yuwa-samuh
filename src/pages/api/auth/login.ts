/**
 * API Route: User login
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyPassword, generateToken } from '@/lib/auth';
import { readGitHubFile } from '@/lib/github';
import type { Settings } from '@/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({ error: 'UserId and password are required' });
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || !owner || !repo) {
    return res.status(500).json({ error: 'GitHub configuration missing' });
  }

  try {
    // Read settings to get users
    const result = await readGitHubFile('data/settings.json', token, owner, repo);
    const settings: Settings | null = result?.data || null;
    
    // Bootstrap fallback: if no users configured yet, allow default admin login
    const defaultAdminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
    if (!settings || !settings.users || settings.users.length === 0) {
      const bootstrapPairs = [
        { id: 'admin', pass: defaultAdminPassword },
        { id: 'Admin', pass: 'Password' }, // user-requested bootstrap credentials
      ];
      const match = bootstrapPairs.find(p => p.id === userId && p.pass === password);
      if (match) {
        const jwtToken = generateToken('admin', 'Admin');
        return res.status(200).json({
          token: jwtToken,
          user: {
            userId: 'admin',
            name: 'Administrator',
            role: 'Admin',
          },
          note: 'Logged in with bootstrap admin. Please create real users in Settings.',
        });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = settings.users.find(u => u.userId === userId);
    if (!user) {
      // Optional bootstrap even when users exist (guarded by env)
      if (process.env.ALLOW_BOOTSTRAP_ADMIN === 'true') {
        const pairs = [
          { id: 'admin', pass: process.env.ADMIN_DEFAULT_PASSWORD || 'admin123' },
          { id: 'Admin', pass: 'Password' },
        ];
        const match = pairs.find(p => p.id === userId && p.pass === password);
        if (match) {
          const jwtToken = generateToken('admin', 'Admin');
          return res.status(200).json({
            token: jwtToken,
            user: { userId: 'admin', name: 'Administrator', role: 'Admin' },
            note: 'Bootstrap admin used via ALLOW_BOOTSTRAP_ADMIN. Create real users in Settings.',
          });
        }
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const jwtToken = generateToken(user.userId, user.role);
    
    res.status(200).json({
      token: jwtToken,
      user: {
        userId: user.userId,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Login failed' });
  }
}

