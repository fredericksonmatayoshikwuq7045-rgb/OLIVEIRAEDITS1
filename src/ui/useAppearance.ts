import { useEffect } from 'react';
import { appearance, type UiSettings } from '../domain/preferences';
export function useAppearance(settings: UiSettings) {
  useEffect(() => {
    const value = appearance(settings),
      root = document.documentElement,
      media = matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      root.dataset.theme = value.theme === 'system' ? (media.matches ? 'light' : 'dark') : value.theme;
      const luminance = (hex: string) => {
        const rgb = hex.match(/[\da-f]{2}/gi)!.map((part) => parseInt(part, 16) / 255);
        return rgb.reduce(
          (sum, channel, index) =>
            sum + (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index],
          0,
        );
      };
      const accentLight = luminance(value.accent),
        isLight = root.dataset.theme === 'light',
        backgroundLight = luminance(isLight ? '#f1f3f7' : '#0c0d10'),
        contrast = (Math.max(accentLight, backgroundLight) + 0.05) / (Math.min(accentLight, backgroundLight) + 0.05);
      root.style.setProperty('--accent', value.accent);
      root.style.setProperty('--on-accent', accentLight > 0.179 ? '#000000' : '#ffffff');
      root.style.setProperty('--accent-text', contrast >= 4.5 ? value.accent : isLight ? '#192332' : '#eceef3');
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
