import type { NextApiRequest, NextApiResponse } from 'next';
import { readGitHubFile, writeGitHubFile } from '@/lib/github';
import { verifyToken } from '@/lib/auth';

type Message = {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const authHeader = req.headers.authorization;
  const authToken = authHeader?.split(' ')[1];
  if (!authToken) return res.status(401).json({ error: 'Authentication required' });
  const payload = verifyToken(authToken);
  if (!payload) return res.status(401).json({ error: 'Invalid token' });
  const sender = payload.userId;

  const githubToken = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!githubToken || !owner || !repo) {
    return res.status(500).json({ error: 'GitHub configuration missing' });
  }

  try {
    const result = await readGitHubFile('data/chat-messages.json', githubToken, owner, repo);
    const list: Message[] = result?.data ?? [];
    const sha = result?.sha;

    const newMsg: Message = {
      id: Date.now().toString(),
      sender,
      text,
      timestamp: new Date().toISOString(),
    };

    list.push(newMsg);

    await writeGitHubFile('data/chat-messages.json', list, githubToken, owner, repo, sha);

    res.status(200).json(newMsg);
  } catch (error: any) {
    console.error('Write chat message error:', error);
    res.status(500).json({ error: error.message || 'Failed to save message' });
  }
}
