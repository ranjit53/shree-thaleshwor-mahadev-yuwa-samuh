import type { NextApiRequest, NextApiResponse } from 'next';
import { readGitHubFile, writeGitHubFile } from '@/lib/github';

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

  const { sender, text } = req.body || {};
  if (!text || !sender) {
    return res.status(400).json({ error: 'Sender and text are required' });
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || !owner || !repo) {
    return res.status(500).json({ error: 'GitHub configuration missing' });
  }

  try {
    const result = await readGitHubFile('data/chat-messages.json', token, owner, repo);
    const list: Message[] = result?.data ?? [];
    const sha = result?.sha;

    const newMsg: Message = {
      id: Date.now().toString(),
      sender,
      text,
      timestamp: new Date().toISOString(),
    };

    list.push(newMsg);

    await writeGitHubFile('data/chat-messages.json', list, token, owner, repo, sha);

    res.status(200).json(newMsg);
  } catch (error: any) {
    console.error('Write chat message error:', error);
    res.status(500).json({ error: error.message || 'Failed to save message' });
  }
}
