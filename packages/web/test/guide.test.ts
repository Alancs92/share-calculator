import { describe, expect, it } from 'vitest';
import { GUIDE_SLIDES, wrapIndex } from '../src/guide.js';

describe('wrapIndex', () => {
  it('leaves in-range indexes unchanged', () => {
    expect(wrapIndex(0, 5)).toBe(0);
    expect(wrapIndex(3, 5)).toBe(3);
  });

  it('wraps forward past the end', () => {
    expect(wrapIndex(5, 5)).toBe(0);
    expect(wrapIndex(6, 5)).toBe(1);
  });

  it('wraps backward past the start', () => {
    expect(wrapIndex(-1, 5)).toBe(4);
    expect(wrapIndex(-6, 5)).toBe(4);
  });

  it('returns 0 for a non-positive length', () => {
    expect(wrapIndex(3, 0)).toBe(0);
  });
});

describe('GUIDE_SLIDES', () => {
  it('has at least one slide, each with a title, image, alt, and caption', () => {
    expect(GUIDE_SLIDES.length).toBeGreaterThan(0);
    for (const slide of GUIDE_SLIDES) {
      expect(slide.title.length).toBeGreaterThan(0);
      expect(slide.image.length).toBeGreaterThan(0);
      expect(slide.alt.length).toBeGreaterThan(0);
      expect(slide.caption.length).toBeGreaterThan(0);
    }
  });
});
