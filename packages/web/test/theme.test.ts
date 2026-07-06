import { describe, expect, it } from 'vitest';
import { oppositeTheme, resolveInitialTheme } from '../src/theme.js';

describe('resolveInitialTheme', () => {
  it('prefers a valid stored theme over the OS setting', () => {
    expect(resolveInitialTheme('light', true)).toBe('light');
    expect(resolveInitialTheme('dark', false)).toBe('dark');
  });

  it('falls back to the OS preference when nothing is stored', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark');
    expect(resolveInitialTheme(null, false)).toBe('light');
  });

  it('falls back to the OS preference when the stored value is invalid', () => {
    expect(resolveInitialTheme('purple', true)).toBe('dark');
    expect(resolveInitialTheme('', false)).toBe('light');
  });
});

describe('oppositeTheme', () => {
  it('flips light and dark', () => {
    expect(oppositeTheme('light')).toBe('dark');
    expect(oppositeTheme('dark')).toBe('light');
  });
});
