import type { NextApiRequest, NextApiResponse } from 'next';
import { readGitHubFile, writeGitHubFile } from '@/lib/github';
import { verifyToken, isAdmin } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Id required' });

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  const authHeader = req.headers.authorization;
  const userToken = authHeader?.split(' ')[1];
  if (!userToken) return res.status(401).json({ error: 'Authentication required' });
  const user = verifyToken(userToken);
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  if (!token || !owner || !repo) {
    return res.status(500).json({ error: 'GitHub configuration missing' });
  }

  try {
    const result = await readGitHubFile('data/chat-messages.json', token, owner, repo);
    const list = result?.data ?? [];
    const sha = result?.sha;

    const msg = list.find((m: any) => m.id === id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    // Admins can delete any message; others can delete only their own
    if (!(isAdmin(user.role) || msg.sender === user.userId)) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }

    const filtered = list.filter((m: any) => m.id !== id);

    await writeGitHubFile('data/chat-messages.json', filtered, token, owner, repo, sha);

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Delete chat message error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete message' });
  }
}
