import type { NextApiRequest, NextApiResponse } from 'next';
import { readGitHubFile } from '@/lib/github';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || !owner || !repo) {
    return res.status(500).json({ error: 'GitHub configuration missing' });
  }

  try {
    const result = await readGitHubFile('data/chat-messages.json', token, owner, repo);
    const data = result?.data ?? [];
    res.status(200).json(data);
  } catch (error: any) {
    console.error('Read chat messages error:', error);
    res.status(500).json({ error: error.message || 'Failed to read messages' });
  }
}
