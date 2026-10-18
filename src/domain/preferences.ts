export interface PersonalQuote {
  id: string;
  text: string;
  author: string;
  language: 'pt-BR' | 'en' | 'es';
}
export interface Appearance {
  theme: 'dark' | 'light' | 'system';
  accent: string;
  font: 'system' | 'serif' | 'mono';
  fontSize: number;
  layout: 'classic' | 'right' | 'focus';
  libraryWidth: number;
  detailsWidth: number;
  animation: boolean;
  performance: boolean;
  quotes: boolean;
  quoteLanguage: 'pt-BR' | 'en' | 'es';
  quoteAuthor: string;
  personalQuotes: PersonalQuote[];
}
export interface UiSettings extends Partial<Appearance> {
  concurrency: number;
  confirmExport: boolean;
}
export const defaultAppearance: Appearance = {
  theme: 'dark',
  accent: '#ed4355',
  font: 'system',
  fontSize: 13,
  layout: 'classic',
  libraryWidth: 240,
  detailsWidth: 285,
  animation: true,
  performance: false,
  quotes: true,
  quoteLanguage: 'pt-BR',
  quoteAuthor: 'all',
  personalQuotes: [],
};
export function appearance(value: Partial<Appearance> = {}): Appearance {
  const options = <T extends string>(key: keyof Appearance, choices: T[], fallback: T): T =>
    choices.includes(value[key] as T) ? (value[key] as T) : fallback;
  const number = (key: keyof Appearance, min: number, max: number, fallback: number) =>
    typeof value[key] === 'number' && Number.isFinite(value[key]) ? Math.max(min, Math.min(max, value[key] as number)) : fallback;
  return {
    ...defaultAppearance,
    theme: options('theme', ['dark', 'light', 'system'], 'dark'),
    accent: typeof value.accent === 'string' && /^#[\da-f]{6}$/i.test(value.accent) ? value.accent : defaultAppearance.accent,
    font: options('font', ['system', 'serif', 'mono'], 'system'),
    fontSize: number('fontSize', 12, 16, 13),
    layout: options('layout', ['classic', 'right', 'focus'], 'classic'),
    libraryWidth: number('libraryWidth', 180, 340, 240),
    detailsWidth: number('detailsWidth', 230, 380, 285),
    animation: value.animation !== false,
    performance: value.performance === true,
    quotes: value.quotes !== false,
    quoteLanguage: options('quoteLanguage', ['pt-BR', 'en', 'es'], 'pt-BR'),
    quoteAuthor: typeof value.quoteAuthor === 'string' ? value.quoteAuthor.slice(0, 80) : 'all',
    personalQuotes: Array.isArray(value.personalQuotes)
      ? value.personalQuotes
          .filter(
            (q) =>
              q &&
              typeof q.text === 'string' &&
              q.text.trim() &&
              q.text.length <= 1000 &&
              typeof q.author === 'string' &&
              typeof q.id === 'string' &&
              ['pt-BR', 'en', 'es'].includes(q.language),
          )
          .slice(0, 100)
      : [],
  };
}
export function readSettings(): UiSettings {
  try {
    const saved = JSON.parse(localStorage.getItem('oe_ui_v2') || '{}');
    return { ...appearance(saved || {}), concurrency: [1, 2, 3].includes(saved?.concurrency) ? saved.concurrency : 1, confirmExport: true };
  } catch {
    return { ...defaultAppearance, concurrency: 1, confirmExport: true };
  }
}
