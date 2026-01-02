import type { NextApiRequest, NextApiResponse } from 'next';
import { readGitHubFile, writeGitHubFile } from '@/lib/github';
import { verifyToken } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  const authToken = authHeader?.split(' ')[1];
  if (!authToken) return res.status(401).json({ error: 'Authentication required' });
  const payload = verifyToken(authToken);
  if (!payload) return res.status(401).json({ error: 'Invalid token' });
  const userId = payload.userId;

  const githubToken = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!githubToken || !owner || !repo) {
    return res.status(500).json({ error: 'GitHub configuration missing' });
  }

  try {
    const result = await readGitHubFile('data/chat-messages.json', githubToken, owner, repo);
    const list = result?.data ?? [];
    const sha = result?.sha;

    let changed = false;
    const updated = list.map((m: any) => {
      m.seenBy = m.seenBy || [];
      if (!m.seenBy.includes(userId)) {
        m.seenBy.push(userId);
        changed = true;
      }
      return m;
    });

    if (changed) {
      await writeGitHubFile('data/chat-messages.json', updated, githubToken, owner, repo, sha);
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Mark seen error:', error);
    res.status(500).json({ error: error.message || 'Failed to mark seen' });
  }
}
