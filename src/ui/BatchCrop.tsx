import { useState } from 'react';
import type { MediaItem, Profile } from '../domain/models';
import { detectBlackBars, isNative } from '../services/native';
import { Button, Section } from './Primitives';

export function BatchCrop({ items, profile, onApply }: { items: MediaItem[]; profile: Profile; onApply: (items: MediaItem[]) => void }) {
  const [busy, setBusy] = useState(false),
    [detected, setDetected] = useState<MediaItem[]>([]),
    [messages, setMessages] = useState<string[]>([]);
  const analyze = async () => {
    setBusy(true);
    const found: MediaItem[] = [],
      errors: string[] = [];
    for (const item of items.filter((item) => item.kind === 'video' && item.status === 'ready')) {
      try {
        const crop = await detectBlackBars(item, profile);
        if (crop) found.push({ ...item, render: { ...item.render, media: { ...item.render.media, crop } } });
        else errors.push(`${item.title}: nenhuma barra detectada na amostra.`);
      } catch (error) {
        errors.push(`${item.title}: ${String(error)}`);
      }
    }
    setDetected(found);
    setMessages(errors);
    setBusy(false);
  };
  return (
    <Section title="Detectar barras pretas em lote" defaultOpen={false}>
      <small>Analisa até 10 segundos de cada vídeo e prepara recortes para conferência.</small>
      <Button
        disabled={!isNative() || busy || !items.some((item) => item.kind === 'video' && item.status === 'ready')}
        onClick={() => void analyze()}
      >
        {busy ? 'Analisando vídeos…' : 'Analisar seleção'}
      </Button>
      {detected.length > 0 && <Button onClick={() => onApply(detected)}>Aplicar {detected.length} recortes detectados</Button>}
      {messages.length > 0 && (
        <details>
          <summary>{messages.length} avisos</summary>
          <ul>
            {messages.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </details>
      )}
    </Section>
  );
}
