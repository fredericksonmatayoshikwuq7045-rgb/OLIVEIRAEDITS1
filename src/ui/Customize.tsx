import { useState } from 'react';
import { appearance, defaultAppearance, type UiSettings } from '../domain/preferences';
import { Button, Field, Modal, Section, Toggle } from './Primitives';
import { QuoteSettings } from './QuoteSettings';
export function Customize({
  settings,
  onChange,
  onClose,
}: {
  settings: UiSettings;
  onChange: (settings: UiSettings) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState('appearance'),
    value = appearance(settings);
  const patch = (change: Partial<typeof value>) => onChange({ ...settings, ...value, ...change });
  return (
    <Modal title="Personalizar seu estúdio" onClose={onClose}>
      <div className="stack">
        <div className="mini-tabs">
          {[
            ['appearance', 'Aparência'],
            ['layout', 'Layout'],
            ['quotes', 'Frases'],
          ].map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'appearance' && (
          <>
            <Field label="Tema">
              <select value={value.theme} onChange={(event) => patch({ theme: event.target.value as typeof value.theme })}>
                <option value="dark">Escuro</option>
                <option value="light">Claro</option>
                <option value="system">Seguir o sistema</option>
              </select>
            </Field>
            <Field label="Cor de destaque">
              <input type="color" value={value.accent} onChange={(event) => patch({ accent: event.target.value })} />
            </Field>
            <Field label="Fonte da interface">
              <select value={value.font} onChange={(event) => patch({ font: event.target.value as typeof value.font })}>
                <option value="system">Sistema</option>
                <option value="serif">Serifada</option>
                <option value="mono">Monoespaçada</option>
              </select>
            </Field>
            <Field label="Tamanho da fonte da interface">
              <input
                type="range"
                min={12}
                max={16}
                value={value.fontSize}
                onChange={(event) => patch({ fontSize: Number(event.target.value) })}
              />
            </Field>
            <small>Estas preferências mudam a interface. Fontes e cores dos seus vídeos são independentes.</small>
            <Toggle label="Animação Matrix na seleção de perfis" checked={value.animation} onChange={(animation) => patch({ animation })} />
            <Toggle
              label="Modo de desempenho"
              hint="Desliga a animação e a extração de miniaturas da timeline; edição e exportação continuam disponíveis."
              checked={value.performance}
              onChange={(performance) => patch({ performance })}
            />
          </>
        )}
        {tab === 'layout' && (
          <Section title="Seu espaço de edição">
            <Field label="Organização dos painéis">
              <select value={value.layout} onChange={(event) => patch({ layout: event.target.value as typeof value.layout })}>
                <option value="classic">Player central · slots abaixo</option>
                <option value="right">Player à direita · slots no centro</option>
                <option value="focus">Modo foco · player ampliado</option>
              </select>
            </Field>
            <small>
              Arraste as divisórias laterais ou use as setas do teclado para ajustar os painéis. No modo foco, volte a um dos outros layouts
              para acessar biblioteca e propriedades.
            </small>
            <Button onClick={() => patch({ layout: 'classic', libraryWidth: 240, detailsWidth: 285 })}>Restaurar layout padrão</Button>
          </Section>
        )}
        {tab === 'quotes' && <QuoteSettings settings={value} onChange={patch} />}
        <div className="form-actions">
          <Button onClick={() => onChange({ ...settings, ...defaultAppearance, personalQuotes: value.personalQuotes })}>
            Restaurar aparência e preferências
          </Button>
          <Button variant="primary" onClick={onClose}>
            Concluir
          </Button>
        </div>
      </div>
    </Modal>
  );
}
