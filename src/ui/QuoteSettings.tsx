import { useState } from 'react';
import type { Appearance } from '../domain/preferences';
import { suggestedAuthors, thoughts } from '../domain/quotes';
import { Button, Field, Toggle } from './Primitives';
export function QuoteSettings({ settings, onChange }: { settings: Appearance; onChange: (value: Partial<Appearance>) => void }) {
  const [text, setText] = useState(''),
    [author, setAuthor] = useState('');
  const authors = [
    ...new Set([...thoughts.map((quote) => quote.author), ...suggestedAuthors, ...settings.personalQuotes.map((quote) => quote.author)]),
  ];
  return (
    <div className="stack">
      <Toggle label="Mostrar frase do dia" checked={settings.quotes} onChange={(quotes) => onChange({ quotes })} />
      <Field label="Idioma das frases">
        <select
          value={settings.quoteLanguage}
          onChange={(event) => onChange({ quoteLanguage: event.target.value as Appearance['quoteLanguage'] })}
        >
          <option value="pt-BR">Português (Brasil)</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </Field>
      <Field label="Autor preferido">
        <select value={settings.quoteAuthor} onChange={(event) => onChange({ quoteAuthor: event.target.value })}>
          <option value="all">Todos os autores</option>
          {authors.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </Field>
      <small>
        As frases são locais, não exigem internet e permanecem iguais durante o dia. Traduções livres e referências aparecem em “Sobre a
        frase”. Para autores sem citação cadastrada, adicione uma referência sua.
      </small>
      <Field label="Minha frase">
        <textarea maxLength={1000} rows={3} value={text} onChange={(event) => setText(event.target.value)} />
      </Field>
      <Field label="Autor ou referência informada por você">
        <input
          value={author}
          maxLength={100}
          onChange={(event) => setAuthor(event.target.value)}
          placeholder="Ex.: Ilia Topuria · entrevista…"
        />
      </Field>
      <Button
        disabled={!text.trim() || settings.personalQuotes.length >= 100}
        onClick={() => {
          onChange({
            personalQuotes: [
              ...settings.personalQuotes,
              { id: crypto.randomUUID(), text: text.trim(), author: author.trim() || 'Minha reflexão', language: settings.quoteLanguage },
            ],
          });
          setText('');
          setAuthor('');
        }}
      >
        Adicionar frase neste idioma
      </Button>
      {settings.personalQuotes.map((quote) => (
        <div className="row-between" key={quote.id}>
          <span className="truncate">
            {quote.text} · {quote.language}
          </span>
          <Button
            variant="ghost"
            aria-label={`Excluir frase ${quote.text.slice(0, 40)}`}
            onClick={() => onChange({ personalQuotes: settings.personalQuotes.filter((value) => value.id !== quote.id) })}
          >
            Excluir
          </Button>
        </div>
      ))}
    </div>
  );
}
