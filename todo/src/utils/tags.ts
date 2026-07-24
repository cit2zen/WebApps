import type { Tag } from '../types';

export function parseTags(text: string): Tag[] {
  return [
    ...new Set(
      text
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
}
