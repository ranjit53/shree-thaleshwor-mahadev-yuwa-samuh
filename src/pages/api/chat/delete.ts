import type { NextApiRequest, NextApiResponse } from 'next';
import { readGitHubFile, writeGitHubFile } from '@/lib/github';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Id required' });

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || !owner || !repo) {
    return res.status(500).json({ error: 'GitHub configuration missing' });
  }

  try {
    const result = await readGitHubFile('data/chat-messages.json', token, owner, repo);
    const list = result?.data ?? [];
    const sha = result?.sha;
    const filtered = list.filter((m: any) => m.id !== id);

    await writeGitHubFile('data/chat-messages.json', filtered, token, owner, repo, sha);

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Delete chat message error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete message' });
  }
}
