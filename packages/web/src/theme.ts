export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'share-calculator:theme';

/** Pure decision: what theme to start in, given a stored preference (if any) and the OS setting. */
export function resolveInitialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDark ? 'dark' : 'light';
}

export function oppositeTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.setAttribute('data-theme', theme);
}

export function persistTheme(theme: Theme, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(THEME_STORAGE_KEY, theme);
}

export function loadStoredTheme(storage: Pick<Storage, 'getItem'> = localStorage): string | null {
  return storage.getItem(THEME_STORAGE_KEY);
}
