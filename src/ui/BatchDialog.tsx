import { useState } from 'react';
import { copyFraming, mixTemplateIds, parseHeadlines, trimItems } from '../domain/batch';
import type { MediaItem, MixRule, Profile, TemplateCategory } from '../domain/models';
import { applyTemplate } from '../domain/templates';
import { createTextLayer, type FitMode } from '../render/types';
import { BatchCrop } from './BatchCrop';
import { Button, Field, Modal, Section, Slider, Toggle } from './Primitives';
export function BatchDialog({
  profile,
  items,
  active,
  onApply,
  onClose,
  onMixChange,
}: {
  profile: Profile;
  items: MediaItem[];
  active: MediaItem | null;
  onApply: (items: MediaItem[]) => void;
  onClose: () => void;
  onMixChange: (category: TemplateCategory, rule: MixRule) => void;
}) {
  const [relative, setRelative] = useState(true);
  const [fit, setFit] = useState<FitMode>('cover'),
    [speed, setSpeed] = useState(1);
  const [trim, setTrim] = useState({ start: 0, end: 0, max: 0 });
  const [headlines, setHeadlines] = useState('');
  const [mix, setMix] = useState<{ category: TemplateCategory; mode: MixRule['mode']; seed: number }>({
    category: 'border',
    mode: profile.mixRules.border?.mode ?? 'sequential',
    seed: profile.mixRules.border?.seed ?? 42,
  });
  const apply = (updated: MediaItem[]) => {
    onApply(updated);
    onClose();
  };
  return (
    <Modal title={`Editar ${items.length} mídias em lote`} onClose={onClose}>
      <p className="muted" style={{ marginBottom: 14 }}>
        Cada ação se aplica à seleção atual e pode ser desfeita com Ctrl + Z.
      </p>
      <Section title="Enquadramento automático">
        <Field label="Modo de ajuste">
          <select value={fit} onChange={(e) => setFit(e.target.value as FitMode)}>
            <option value="cover">Preencher</option>
            <option value="contain">Caber</option>
            <option value="blur">Fundo desfocado</option>
          </select>
        </Field>
        <Button
          onClick={() =>
            apply(
              items.map((item) => ({
                ...item,
                render: { ...item.render, media: { ...item.render.media, fit, zoom: 1, pan: { x: 0, y: 0 } } },
              })),
            )
          }
        >
          Auto-enquadrar seleção
        </Button>
        <Toggle
          label="Aplicar enquadramento relativo"
          checked={relative}
          onChange={setRelative}
          hint="Mantém proporções entre mídias de resoluções diferentes."
        />
        {active && (
          <Button onClick={() => apply(items.map((item) => copyFraming(active, item, relative)))}>Copiar enquadramento atual</Button>
        )}
      </Section>
      <BatchCrop items={items} profile={profile} onApply={apply} />
      <Section title="Duração e velocidade">
        <div className="form-grid">
          <Field label="Cortar início (s)">
            <input
              type="number"
              min={0}
              step={0.1}
              value={trim.start}
              onChange={(e) => setTrim((p) => ({ ...p, start: Math.max(0, Number(e.target.value)) }))}
            />
          </Field>
          <Field label="Cortar fim (s)">
            <input
              type="number"
              min={0}
              step={0.1}
              value={trim.end}
              onChange={(e) => setTrim((p) => ({ ...p, end: Math.max(0, Number(e.target.value)) }))}
            />
          </Field>
        </div>
        <Field label="Duração máxima (s; 0 = sem limite)">
          <input
            type="number"
            min={0}
            step={0.1}
            value={trim.max}
            onChange={(e) => setTrim((p) => ({ ...p, max: Math.max(0, Number(e.target.value)) }))}
          />
        </Field>
        <Button onClick={() => apply(trimItems(items, trim.start, trim.end, trim.max || undefined))}>Aplicar cortes</Button>
        <Slider label="Velocidade" value={speed} min={0.5} max={2} step={0.05} suffix="×" onChange={setSpeed} />
        <Button onClick={() => apply(items.map((item) => (item.kind === 'video' ? { ...item, speed } : item)))}>Aplicar velocidade</Button>
      </Section>
      <Section title="Variação de headline" defaultOpen={false}>
        <Field label="Um texto por linha, ou CSV">
          <textarea
            rows={5}
            value={headlines}
            onChange={(e) => setHeadlines(e.target.value)}
            placeholder={'Primeira headline\nSegunda headline\nTerceira headline'}
          />
        </Field>
        <small>Os textos são distribuídos na ordem das mídias; se necessário, a lista recomeça.</small>
        <Button
          disabled={!parseHeadlines(headlines).length}
          onClick={() => {
            const texts = parseHeadlines(headlines);
            apply(
              items.map((item, index) => {
                const layer = { ...createTextLayer(), id: 'batch-headline', text: texts[index % texts.length] };
                return {
                  ...item,
                  headlineText: layer.text,
                  render: { ...item.render, layers: [...item.render.layers.filter((l) => l.id !== 'batch-headline'), layer] },
                };
              }),
            );
          }}
        >
          Distribuir headlines
        </Button>
      </Section>
      <Section title="Mix de templates" defaultOpen={false}>
        <Field label="Categoria">
          <select
            value={mix.category}
            onChange={(e) =>
              setMix({
                category: e.target.value as TemplateCategory,
                mode: profile.mixRules[e.target.value as TemplateCategory]?.mode ?? 'sequential',
                seed: profile.mixRules[e.target.value as TemplateCategory]?.seed ?? 42,
              })
            }
          >
            <option value="border">Borda</option>
            <option value="watermark">Marca d'água</option>
            <option value="headline">Headline</option>
            <option value="background">Fundo</option>
          </select>
        </Field>
        <Field label="Distribuição">
          <select value={mix.mode} onChange={(e) => setMix((p) => ({ ...p, mode: e.target.value as typeof mix.mode }))}>
            <option value="fixed">Fixo (primeiro template)</option>
            <option value="sequential">Sequencial</option>
            <option value="random">Aleatória com semente</option>
            <option value="no-repeat">Sem repetir consecutivo</option>
          </select>
        </Field>
        <Field label="Semente">
          <input type="number" value={mix.seed} onChange={(e) => setMix((p) => ({ ...p, seed: Number(e.target.value) }))} />
        </Field>
        <small>Usa os templates desta categoria na conta ativa.</small>
        <Button
          disabled={!profile.templates.some((t) => t.category === mix.category)}
          onClick={() => {
            const templates = profile.templates.filter((t) => t.category === mix.category);
            const ids = mixTemplateIds(
              templates.map((t) => t.id),
              items.length,
              mix.mode,
              mix.seed,
            );
            onMixChange(mix.category, { mode: mix.mode, seed: mix.seed, templateIds: templates.map((template) => template.id) });
            apply(items.map((item, index) => applyTemplate(item, templates.find((t) => t.id === ids[index]) || null, mix.category)));
          }}
        >
          Aplicar mix na seleção
        </Button>
      </Section>
    </Modal>
  );
}
