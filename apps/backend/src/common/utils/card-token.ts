import { createHash, randomBytes } from 'crypto';

export function generateCardToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashCardToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
