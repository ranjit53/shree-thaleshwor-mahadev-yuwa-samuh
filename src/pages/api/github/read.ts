/**
 * API Route: Read JSON file from GitHub
 * This route proxies GitHub API calls to keep the token secure on the backend
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { readGitHubFile } from '@/lib/github';

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
      error: 'GitHub configuration missing. Please set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in environment variables.' 
    });
  }

  try {
    const result = await readGitHubFile(path, token, owner, repo);
    res.status(200).json({ data: result?.data || null, sha: result?.sha });
  } catch (error: any) {
    console.error('GitHub read error:', error);
    res.status(500).json({ error: error.message || 'Failed to read file from GitHub' });
  }
}

