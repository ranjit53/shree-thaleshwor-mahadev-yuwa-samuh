/**
 * API Route: Write JSON file to GitHub
 * This route proxies GitHub API calls to keep the token secure on the backend
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { readGitHubFile, writeGitHubFile } from '@/lib/github';
import { verifyToken } from '@/lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { path, content, sha } = req.body;

  if (!path || content === undefined) {
    return res.status(400).json({ error: 'Path and content are required' });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!githubToken || !owner || !repo) {
    return res.status(500).json({ 
      error: 'GitHub configuration missing. Please set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in environment variables.' 
    });
  }

  try {
    // If sha not provided, fetch it first for updates
    let fileSha = sha;
    if (!fileSha) {
      try {
        const existing = await readGitHubFile(path, githubToken, owner, repo);
        if (existing?.sha) {
          fileSha = existing.sha;
        } else {
          // File might not exist, but we need to check by trying to get file info directly
          const checkResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            {
              headers: {
                Authorization: `token ${githubToken}`,
                Accept: 'application/vnd.github.v3+json',
              },
            }
          );
          if (checkResponse.ok) {
            const fileInfo = await checkResponse.json();
            fileSha = fileInfo.sha;
          }
        }
      } catch (e) {
        // File doesn't exist, that's fine for new files
        console.log('File may not exist, will attempt to create');
      }
    }

    // Always provide sha if file exists (required by GitHub API for updates)
    await writeGitHubFile(path, content, githubToken, owner, repo, fileSha);
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('GitHub write error:', error);
    
    // If error is about sha (422 or 409), try to fetch current sha and retry
    if (error.message.includes('sha') || error.message.includes('422') || error.message.includes('409')) {
      try {
        // Fetch current file SHA directly from GitHub
        const checkResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
          {
            headers: {
              Authorization: `token ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );
        if (checkResponse.ok) {
          const fileInfo = await checkResponse.json();
          await writeGitHubFile(path, content, githubToken, owner, repo, fileInfo.sha);
          return res.status(200).json({ success: true });
        }
      } catch (retryError: any) {
        console.error('Retry failed:', retryError);
        // Fall through to error response
      }
    }
    
    res.status(500).json({ error: error.message || 'Failed to write file to GitHub' });
  }
}

