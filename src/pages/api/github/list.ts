/**
 * API Route: List files in GitHub directory
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { listGitHubFiles } from '@/lib/github';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { path } = req.body;

  if (!path) {
    return res.status(400).json({ error: 'Path is required' });
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || !owner || !repo) {
    return res.status(500).json({ 
      error: 'GitHub configuration missing' 
    });
  }

  try {
    const files = await listGitHubFiles(path, token, owner, repo);
    res.status(200).json({ files });
  } catch (error: any) {
    console.error('GitHub list error:', error);
    res.status(500).json({ error: error.message || 'Failed to list files' });
  }
}

