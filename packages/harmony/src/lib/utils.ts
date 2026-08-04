import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge multiple class names
 * @param inputs - The class names to merge
 * @returns The merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Compute uppercase initials from a name-like string.
 * - Multi-word: first letter of first word + first letter of last word (first hyphen segment)
 * - Single hyphenated: first letter of first segment + first letter of last segment
 * - Single token: first two characters
 * - Underscores treated as spaces; repeated whitespace collapsed
 */
export function getInitials(input: string): string {
  const normalized = input.replace(/_+/g, ' ').trim().replace(/\s+/g, ' ');

  if (!normalized) return '';

  const getFirstChar = (value: string): string => {
    const match = value.match(/[A-Za-z0-9]/);
    return match ? match[0] : '';
  };

  const words = normalized.split(' ');

  let initials = '';
  if (words.length === 1) {
    const token = words[0];
    if (token.includes('-')) {
      const hyphenParts = token.split('-').filter(Boolean);
      const first = getFirstChar(hyphenParts[0] || '');
      const last = getFirstChar(hyphenParts[hyphenParts.length - 1] || '');
      initials = `${first}${last}`;
    } else {
      initials = token.slice(0, 2);
    }
  } else {
    const firstWord = words[0];
    const lastWord = words[words.length - 1];
    const lastMain = lastWord.includes('-') ? lastWord.split('-')[0] : lastWord;
    const first = getFirstChar(firstWord);
    const last = getFirstChar(lastMain);
    initials = `${first}${last}`;
  }

  return initials.toUpperCase();
}
