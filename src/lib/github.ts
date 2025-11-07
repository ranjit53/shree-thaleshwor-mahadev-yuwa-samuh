/**
 * GitHub REST API utility functions
 * These functions interact with GitHub API to read/write JSON files in the repository
 * 
 * IMPORTANT: The GITHUB_TOKEN should NEVER be exposed to the frontend.
 * All GitHub API calls must go through backend API routes that hold the token.
 */

export interface GitHubFile {
  sha: string;
  content: string;
  path: string;
}

export interface GitHubFileResponse {
  sha: string;
  content: string;
  encoding: string;
}

/**
 * Read a JSON file from GitHub repository
 * This should be called from backend API routes only
 * Returns both the content and SHA for update operations
 */
export async function readGitHubFile(
  path: string,
  token: string,
  owner: string,
  repo: string
): Promise<{ data: any; sha?: string } | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      // File doesn't exist yet, return null
      return null;
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const fileData: GitHubFileResponse = await response.json();
  
  // Decode base64 content (Node.js Buffer API - API routes run in Node.js)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Buffer = require('buffer').Buffer;
  const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
  
  try {
    const data = JSON.parse(content);
    return { data, sha: fileData.sha };
  } catch (e) {
    // If file is empty or invalid JSON, return null
    return null;
  }
}

/**
 * Write a JSON file to GitHub repository
 * This should be called from backend API routes only
 */
export async function writeGitHubFile(
  path: string,
  content: any,
  token: string,
  owner: string,
  repo: string,
  sha?: string
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  
  // Convert content to base64 (Node.js Buffer API - API routes run in Node.js)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Buffer = require('buffer').Buffer;
  const jsonContent = JSON.stringify(content, null, 2);
  const base64Content = Buffer.from(jsonContent).toString('base64');
  
  const body: any = {
    message: `Update ${path}`,
    content: base64Content,
  };

  // Include sha for updates to handle concurrency
  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`GitHub API error: ${response.status} - ${error.message || response.statusText}`);
  }
}

/**
 * List backup files from backups/ directory
 */
export async function listGitHubFiles(
  path: string,
  token: string,
  owner: string,
  repo: string
): Promise<string[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const files: GitHubFile[] = await response.json();
  return files.map(f => f.path);
}

