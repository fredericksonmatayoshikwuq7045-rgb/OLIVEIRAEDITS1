import type { Appearance } from './preferences';
export interface DailyThought {
  id: string;
  author: string;
  source: string;
  url?: string;
  text: Record<'pt-BR' | 'en' | 'es', string>;
  translated?: boolean;
}
export const thoughts: DailyThought[] = [
  {
    id: 'musk-trend',
    author: 'Elon Musk',
    source: 'Discurso de formatura, USC Marshall, 2014. PT/ES: tradução livre.',
    translated: true,
    text: { 'pt-BR': 'Não siga simplesmente a tendência.', en: 'Don’t just follow the trend.', es: 'No te limites a seguir la tendencia.' },
  },
  {
    id: 'philippians-4-13',
    author: 'Bíblia',
    source: 'Filipenses 4:13 · Almeida / King James / Reina-Valera 1909',
    text: {
      'pt-BR': 'Posso todas as coisas naquele que me fortalece.',
      en: 'I can do all things through Christ which strengtheneth me.',
      es: 'Todo lo puedo en Cristo que me fortalece.',
    },
  },
  {
    id: 'proverbs-16-3',
    author: 'Bíblia',
    source: 'Provérbios 16:3 · Almeida / King James / Reina-Valera 1909',
    text: {
      'pt-BR': 'Confia ao Senhor as tuas obras, e teus pensamentos serão estabelecidos.',
      en: 'Commit thy works unto the LORD, and thy thoughts shall be established.',
      es: 'Encomienda a Jehová tus obras, y tus pensamientos serán afirmados.',
    },
  },
  {
    id: 'ecclesiastes-3-1',
    author: 'Bíblia',
    source: 'Eclesiastes 3:1 · Almeida / King James / Reina-Valera 1909',
    text: {
      'pt-BR': 'Tudo tem o seu tempo determinado, e há tempo para todo o propósito debaixo do céu.',
      en: 'To every thing there is a season, and a time to every purpose under the heaven.',
      es: 'Para todas las cosas hay sazón, y todo lo que se quiere debajo del cielo, tiene su tiempo.',
    },
  },
  {
    id: 'schopenhauer-happiness',
    author: 'Arthur Schopenhauer',
    source: 'Counsels and Maxims · tradução inglesa de T. Bailey Saunders. PT/ES: tradução livre.',
    url: 'https://www.gutenberg.org/ebooks/10715',
    translated: true,
    text: {
      'pt-BR': 'O caminho mais seguro para não ser muito infeliz é não esperar ser muito feliz.',
      en: 'The safest way of not being very miserable is not to expect to be very happy.',
      es: 'La forma más segura de no ser muy desdichado es no esperar ser muy feliz.',
    },
  },
  {
    id: 'edison-genius',
    author: 'Thomas Edison',
    source: 'Citação registrada em Harper’s Monthly, setembro de 1932. PT/ES: tradução livre.',
    translated: true,
    text: {
      'pt-BR': 'Genialidade é um por cento inspiração e noventa e nove por cento transpiração.',
      en: 'Genius is one per cent inspiration and ninety-nine per cent perspiration.',
      es: 'El genio es uno por ciento inspiración y noventa y nueve por ciento transpiración.',
    },
  },
  {
    id: 'zuckerberg-fail',
    author: 'Mark Zuckerberg',
    source: 'Discurso em Harvard, 2017. PT/ES: tradução livre.',
    url: 'https://news.harvard.edu/gazette/story/2017/05/mark-zuckerbergs-speech-as-written-for-harvards-class-of-2017/',
    translated: true,
    text: {
      'pt-BR': 'Os maiores sucessos vêm da liberdade de falhar.',
      en: 'The greatest successes come from having the freedom to fail.',
      es: 'Los mayores éxitos nacen de tener la libertad de fallar.',
    },
  },
  {
    id: 'goggins-potential',
    author: 'David Goggins',
    source: 'Can’t Hurt Me, 2018. PT/ES: tradução livre.',
    translated: true,
    text: {
      'pt-BR': 'Você corre o risco de viver uma vida tão confortável e fácil que morrerá sem jamais descobrir seu verdadeiro potencial.',
      en: 'You are in danger of living a life so comfortable and soft, that you will die without ever realizing your true potential.',
      es: 'Corres el riesgo de vivir una vida tan cómoda y fácil que morirás sin descubrir tu verdadero potencial.',
    },
  },
  {
    id: 'reflection-step',
    author: 'Reflexões do estúdio',
    source: 'Texto original do Oliveira Edits · sem atribuição a terceiros.',
    text: {
      'pt-BR': 'Hoje, escolha um passo pequeno que você consiga terminar. Consistência também se constrói no simples.',
      en: 'Today, choose one small step you can finish. Consistency is also built through simple things.',
      es: 'Hoy, elige un paso pequeño que puedas terminar. La constancia también se construye con lo sencillo.',
    },
  },
];
export const suggestedAuthors = ['Arthur Schopenhauer', 'Thomas Edison', 'Elon Musk', 'Mark Zuckerberg', 'David Goggins', 'Ilia Topuria'];
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dailyThought(
  settings: Appearance,
  day: string,
  profileId = '',
): { text: string; author: string; source: string; url?: string } | null {
  const catalog = thoughts.map((quote) => ({
    text: quote.text[settings.quoteLanguage],
    author: quote.author,
    source: quote.source,
    url: quote.url,
  }));
  catalog.push(
    ...settings.personalQuotes
      .filter((quote) => quote.language === settings.quoteLanguage)
      .map((quote) => ({
        text: quote.text,
        author: quote.author || 'Minha reflexão',
        source: 'Adicionada por você · autoria e referência informadas pelo usuário.',
        url: undefined,
      })),
  );
  const selected = catalog.filter((quote) => settings.quoteAuthor === 'all' || quote.author === settings.quoteAuthor);
  if (!selected.length) return null;
  let hash = 0;
  for (const char of `${day}:${profileId}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return selected[hash % selected.length];
}
