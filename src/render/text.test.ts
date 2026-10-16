import { describe, expect, it } from 'vitest';
import { wrapText } from './text';

const measure = (text: string) => Array.from(text).length * 10;

describe('automatic text line wrapping', () => {
  it('wraps at word boundaries and preserves explicit empty paragraphs', () => {
    expect(wrapText('um dois três\n\nquatro', 70, measure)).toEqual(['um dois', 'três', '', 'quatro']);
  });
  it('breaks a long word without losing Unicode characters', () => {
    expect(wrapText('abc😀def', 30, measure)).toEqual(['abc', '😀de', 'f']);
  });
  it('does not discard a single glyph wider than the box', () => {
    expect(wrapText('á é', 1, measure)).toEqual(['á', 'é']);
  });
  it('keeps the final empty line from an explicit newline', () => {
    expect(wrapText('abc\n', 50, measure)).toEqual(['abc', '']);
  });
});
