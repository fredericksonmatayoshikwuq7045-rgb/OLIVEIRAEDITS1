import { useEffect } from 'react';
import { appearance, type UiSettings } from '../domain/preferences';
export function useAppearance(settings: UiSettings) {
  useEffect(() => {
    const value = appearance(settings),
      root = document.documentElement,
      media = matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      root.dataset.theme = value.theme === 'system' ? (media.matches ? 'light' : 'dark') : value.theme;
      root.style.setProperty('--accent', value.accent);
      root.style.setProperty('--accent-hover', value.accent);
      root.style.setProperty('--accent-soft', `${value.accent}20`);
      root.style.fontSize = `${value.fontSize}px`;
      root.style.fontFamily =
        value.font === 'serif'
          ? 'Georgia, serif'
          : value.font === 'mono'
            ? 'Consolas, monospace'
            : 'Segoe UI, ui-sans-serif, system-ui, sans-serif';
      root.dataset.performance = String(value.performance);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings]);
}
