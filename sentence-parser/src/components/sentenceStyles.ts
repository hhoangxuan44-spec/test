import type { Role } from '../../shared/types';

export const ROLE_STYLES: Record<Role, { token: string; button: string; dot: string }> = {
  subject: { token: 'bg-blue-100 text-blue-900 ring-1 ring-blue-400', button: 'border-blue-500 bg-blue-50 text-blue-800', dot: 'bg-blue-500' },
  predicate: { token: 'bg-red-100 text-red-900 ring-1 ring-red-400', button: 'border-red-500 bg-red-50 text-red-800', dot: 'bg-red-500' },
  complement: { token: 'bg-lime-100 text-lime-900 ring-1 ring-lime-500', button: 'border-lime-600 bg-lime-50 text-lime-800', dot: 'bg-lime-600' },
};

export function stripPunct(text: string): string {
  return text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

export function joinTokens(tokens: string[], indices: number[]): string {
  return stripPunct(indices.map((i) => tokens[i]).join(' '));
}
