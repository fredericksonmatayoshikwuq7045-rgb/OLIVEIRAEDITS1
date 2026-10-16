import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import type { MediaItem, Profile } from '../domain/models';
import { createTextLayer, type RenderLayer, type RenderTextLayer } from '../render/types';
import { Button, Field, IconButton, Section, Slider, Toggle } from './Primitives';
export function TextProperties({
  item,
  profile,
  selectedId,
  onSelect,
  onChange,
  onApplyText,
  onSaveStyle,
}: {
  item: MediaItem;
  profile: Profile;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (item: MediaItem) => void;
  onApplyText: () => void;
  onSaveStyle: (layer: RenderTextLayer) => void;
}) {
  const layers = item.render.layers;
  const selected = layers.find((layer) => layer.id === selectedId);
  const text = selected?.type === 'text' ? selected : null;
  const replace = (updated: RenderLayer[]) => onChange({ ...item, render: { ...item.render, layers: updated } });
  const patch = (change: Partial<RenderTextLayer>) => {
    if (text) replace(layers.map((layer) => (layer.id === text.id ? { ...text, ...change } : layer)));
  };
  const patchBase = (change: Partial<RenderLayer>) => {
    if (selected) replace(layers.map((layer) => (layer.id === selected.id ? ({ ...layer, ...change } as RenderLayer) : layer)));
  };
  return (
    <>
      <Section title="Camadas">
        <Button
          variant="primary"
          onClick={() => {
            const layer = createTextLayer();
            layer.text = 'Seu texto aqui';
            replace([...layers, layer]);
            onSelect(layer.id);
          }}
        >
          <Plus /> Adicionar texto
        </Button>
        <div className="stack" style={{ gap: 6 }}>
          {[...layers]
            .sort((a, b) => b.zIndex - a.zIndex)
            .map((layer) => (
              <div className={`layer-row ${layer.id === selectedId ? 'active' : ''}`} key={layer.id}>
                <button onClick={() => onSelect(layer.id)}>{layer.type === 'text' ? layer.text || 'Texto vazio' : 'Template'}</button>
                <IconButton
                  label="Mostrar ou ocultar camada"
                  onClick={() => replace(layers.map((l) => (l.id === layer.id ? { ...l, visible: !l.visible } : l)))}
                >
                  {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </IconButton>
                <IconButton
                  label="Remover camada"
                  onClick={() => {
                    replace(layers.filter((l) => l.id !== layer.id));
                    if (selectedId === layer.id) onSelect(null);
                  }}
                >
                  <Trash2 size={12} />
                </IconButton>
              </div>
            ))}
        </div>
        {layers.length === 0 && <small>Adicione um texto ou escolha um template na biblioteca.</small>}
      </Section>
      {text && (
        <>
          <Section title="Conteúdo e fonte">
            <Field label="Texto">
              <textarea aria-label="Texto da camada" rows={4} value={text.text} onChange={(e) => patch({ text: e.target.value })} />
            </Field>
            <Field label="Fonte">
              <select value={text.fontFamily} onChange={(e) => patch({ fontFamily: e.target.value })}>
                {[
                  ...new Set([
                    'sans-serif',
                    'Arial',
                    'Impact',
                    'Georgia',
                    'Verdana',
                    'monospace',
                    ...profile.fonts.map((font) => font.family),
                    text.fontFamily,
                  ]),
                ].map((family) => (
                  <option key={family} value={family}>
                    {family === 'sans-serif' ? 'Padrão do sistema' : family}
                  </option>
                ))}
              </select>
            </Field>
            <Slider
              label="Tamanho (% da altura)"
              min={0.008}
              max={0.15}
              step={0.001}
              value={text.fontSize}
              onChange={(fontSize) => patch({ fontSize })}
            />
            <div className="row">
              <Toggle label="Negrito" checked={text.bold} onChange={(bold) => patch({ bold })} />
              <Toggle label="Itálico" checked={text.italic} onChange={(italic) => patch({ italic })} />
            </div>
            <Field label="Alinhamento">
              <select value={text.align} onChange={(e) => patch({ align: e.target.value as RenderTextLayer['align'] })}>
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select>
            </Field>
            <Slider
              label="Espaçamento entre linhas"
              value={text.lineHeight}
              min={0.8}
              max={2}
              step={0.05}
              onChange={(lineHeight) => patch({ lineHeight })}
            />
            <Field label="Cor do texto">
              <input type="color" value={text.color} onChange={(e) => patch({ color: e.target.value })} />
            </Field>
          </Section>
          <Section title="Fundo, contorno e sombra" defaultOpen={false}>
            <div className="form-grid">
              <Field label="Fundo">
                <input
                  type="color"
                  value={text.background.color}
                  onChange={(e) => patch({ background: { ...text.background, color: e.target.value } })}
                />
              </Field>
              <Field label="Contorno">
                <input
                  type="color"
                  value={text.stroke.color}
                  onChange={(e) => patch({ stroke: { ...text.stroke, color: e.target.value } })}
                />
              </Field>
            </div>
            <Slider
              label="Opacidade do fundo"
              value={text.background.opacity}
              min={0}
              max={1}
              step={0.01}
              onChange={(opacity) => patch({ background: { ...text.background, opacity } })}
            />
            <Slider
              label="Padding"
              value={text.background.padding}
              min={0}
              max={0.1}
              step={0.001}
              onChange={(padding) => patch({ background: { ...text.background, padding } })}
            />
            <Slider
              label="Raio dos cantos"
              value={text.background.radius}
              min={0}
              max={0.1}
              step={0.001}
              onChange={(radius) => patch({ background: { ...text.background, radius } })}
            />
            <Slider
              label="Espessura do contorno"
              value={text.stroke.width}
              min={0}
              max={0.015}
              step={0.0005}
              onChange={(width) => patch({ stroke: { ...text.stroke, width } })}
            />
            <Toggle
              label="Sombra do texto"
              checked={text.shadow.blur > 0}
              onChange={(active) =>
                patch({ shadow: { color: active ? '#000000' : '#00000000', blur: active ? 0.008 : 0, offsetX: 0.003, offsetY: 0.003 } })
              }
            />
          </Section>
          <Section title="Estilos e aplicação">
            <Button onClick={() => onSaveStyle(text)}>Salvar estilo na conta</Button>
            {profile.textStyles.length > 0 && (
              <Field label="Estilo salvo">
                <select
                  value=""
                  onChange={(e) => {
                    const style = profile.textStyles.find((s) => s.id === e.target.value);
                    if (style)
                      patch({
                        fontFamily: style.fontFamily,
                        fontSize: style.fontSize,
                        color: style.color,
                        background: { ...text.background, color: style.backgroundColor },
                        stroke: { color: style.strokeColor || '#000000', width: style.strokeWidth || 0 },
                      });
                  }}
                >
                  <option value="">Escolher estilo…</option>
                  {profile.textStyles.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Button onClick={onApplyText}>Copiar textos para selecionadas</Button>
          </Section>
        </>
      )}
      {selected && (
        <Section title="Posição e ordem">
          <Slider
            label="X"
            value={selected.rect.x}
            min={-0.5}
            max={1}
            step={0.005}
            onChange={(x) => patchBase({ rect: { ...selected.rect, x } })}
          />
          <Slider
            label="Y"
            value={selected.rect.y}
            min={-0.5}
            max={1}
            step={0.005}
            onChange={(y) => patchBase({ rect: { ...selected.rect, y } })}
          />
          <Slider
            label="Largura"
            value={selected.rect.width}
            min={0.05}
            max={1.5}
            step={0.005}
            onChange={(width) => patchBase({ rect: { ...selected.rect, width } })}
          />
          <Slider label="Rotação" value={selected.rotation} min={-180} max={180} onChange={(rotation) => patchBase({ rotation })} />
          <Slider label="Opacidade" value={selected.opacity} min={0} max={1} step={0.01} onChange={(opacity) => patchBase({ opacity })} />
          <div className="property-buttons">
            <Button onClick={() => patchBase({ zIndex: selected.zIndex + 1 })}>
              <ArrowUp /> Frente
            </Button>
            <Button onClick={() => patchBase({ zIndex: selected.zIndex - 1 })}>
              <ArrowDown /> Trás
            </Button>
            <Button
              title="Duplicar camada"
              onClick={() => {
                const layer = { ...selected, id: crypto.randomUUID(), rect: { ...selected.rect, y: selected.rect.y + 0.02 } };
                replace([...layers, layer]);
                onSelect(layer.id);
              }}
            >
              <Copy />
            </Button>
          </div>
          <small>Arraste a camada selecionada na prévia para reposicioná-la.</small>
        </Section>
      )}
    </>
  );
}
