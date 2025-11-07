/**
 * Authentication utilities
 * Uses JWT for session management and role-based access control
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export interface User {
  userId: string;
  name: string;
  password: string; // hashed
  role: 'Admin' | 'Viewer';
}

export interface JWTPayload {
  userId: string;
  role: 'Admin' | 'Viewer';
}

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(userId: string, role: 'Admin' | 'Viewer'): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (e) {
    return null;
  }
}

/**
 * Check if user has admin role
 */
export function isAdmin(role: string): boolean {
  return role === 'Admin';
}

