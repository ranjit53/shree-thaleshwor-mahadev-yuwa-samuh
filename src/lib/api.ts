/**
 * Frontend API client functions
 * These functions call the backend API routes which proxy GitHub API calls
 */

const API_BASE = '/api';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success?: boolean;
}

/**
 * Read a JSON file from GitHub (via backend API)
 */
export async function readFile<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}/github/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });

    const result: ApiResponse<T & { sha?: string }> = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to read file');
    }

    return result.data || null;
  } catch (error: any) {
    console.error('Read file error:', error);
    throw error;
  }
}

/**
 * Write a JSON file to GitHub (via backend API)
 * Automatically fetches SHA if not provided
 */
export async function writeFile<T>(path: string, content: T, sha?: string): Promise<void> {
  const token = localStorage.getItem('token');
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  try {
    // If SHA not provided, try to fetch it first
    let fileSha = sha;
    if (!fileSha) {
      try {
        const readResponse = await fetch(`${API_BASE}/github/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path }),
        });
        const readResult: ApiResponse<any> & { sha?: string } = await readResponse.json();
        if (readResult.sha) {
          fileSha = readResult.sha;
        }
      } catch (e) {
        // File doesn't exist yet, that's fine - will create new file
        console.log('File does not exist, will create new file');
      }
    }

    const response = await fetch(`${API_BASE}/github/write`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ path, content, sha: fileSha }),
    });

    const result: ApiResponse<void> = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to write file');
    }
  } catch (error: any) {
    console.error('Write file error:', error);
    throw error;
  }
}

/**
 * List files in a GitHub directory
 */
export async function listFiles(path: string): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE}/github/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });

    const result: ApiResponse<{ files: string[] }> = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to list files');
    }

    return result.data?.files || [];
  } catch (error: any) {
    console.error('List files error:', error);
    throw error;
  }
}

/**
 * Login user
 */
export async function login(userId: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password }),
  });

  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.error || 'Login failed');
  }

  localStorage.setItem('token', result.token);
  localStorage.setItem('user', JSON.stringify(result.user));
  
  return result;
}

/**
 * Verify token and get current user
 */
export async function verifyAuth() {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/verify`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return null;
    }

    const result = await response.json();
    return result.user;
  } catch (error) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return null;
  }
}

/**
 * Logout user
 */
export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

