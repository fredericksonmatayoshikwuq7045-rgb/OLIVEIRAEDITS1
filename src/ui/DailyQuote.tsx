import { useEffect, useState } from 'react';
import { appearance, type UiSettings } from '../domain/preferences';
import { dailyThought, localDay } from '../domain/quotes';
import { IconButton } from './Primitives';
export function DailyQuote({ settings, profileId = '', compact = false }: { settings: UiSettings; profileId?: string; compact?: boolean }) {
  const [day, setDay] = useState(localDay),
    [hidden, setHidden] = useState(false),
    value = appearance(settings);
  const key = `oe_quote_dismissed_${profileId}`;
  useEffect(() => {
    try {
      setHidden(compact && localStorage.getItem(key) === day);
    } catch {
      setHidden(false);
    }
  }, [key, day, compact]);
  useEffect(() => {
    const timer = setInterval(() => setDay(localDay()), 60000);
    return () => clearInterval(timer);
  }, []);
  const quote = dailyThought(value, day, profileId);
  if (!value.quotes || hidden) return null;
  return (
    <aside className={`daily-quote ${compact ? 'quote-compact' : ''}`} aria-label="Frase do dia">
      <div>
        <span className="eyebrow">{compact ? 'BOAS-VINDAS AO SEU ESTÚDIO' : 'UMA PAUSA ANTES DE CRIAR'}</span>
        {quote ? (
          <>
            <blockquote lang={value.quoteLanguage}>{quote.text}</blockquote>
            <span className="quote-author">{quote.author}</span>
            <details>
              <summary>Sobre a frase</summary>
              <small>{quote.source}</small>
              {quote.url && <p className="tiny">Referência: {quote.url}</p>}
            </details>
          </>
        ) : (
          <p>Adicione uma frase deste autor e idioma em Personalizar → Frases. Nenhuma citação será atribuída automaticamente a ele.</p>
        )}
      </div>
      {compact && (
        <IconButton
          label="Ocultar frase por hoje"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(key, day);
            } catch {
              /* The visible preference still applies for this session. */
            }
          }}
        >
          ×
        </IconButton>
      )}
    </aside>
  );
}
