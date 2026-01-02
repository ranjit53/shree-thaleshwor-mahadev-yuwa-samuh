import type { NextApiRequest, NextApiResponse } from 'next';
import { readGitHubFile, writeGitHubFile } from '@/lib/github';

type Message = {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  edited?: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, text } = req.body || {};
  if (!id || typeof text !== 'string') {
    return res.status(400).json({ error: 'Id and text are required' });
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

    const idx = list.findIndex(m => m.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Message not found' });

    list[idx].text = text;
    list[idx].edited = true;
    list[idx].timestamp = new Date().toISOString();

    await writeGitHubFile('data/chat-messages.json', list, token, owner, repo, sha);

    res.status(200).json(list[idx]);
  } catch (error: any) {
    console.error('Edit chat message error:', error);
    res.status(500).json({ error: error.message || 'Failed to edit message' });
  }
}
