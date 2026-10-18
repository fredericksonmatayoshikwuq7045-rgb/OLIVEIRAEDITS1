import { Files, Layers, Shapes, Type } from 'lucide-react';
import { createTextLayer } from '../render/types';
import { applyTemplate } from '../domain/templates';
import { canvasForAspect } from '../domain/defaults';
import { ActionMenu } from './ActionMenu';
import { Button } from './Primitives';
import { Library } from './Library';
import { ProjectMedia } from './ProjectMedia';
import type { EditorContext } from './useEditor';
export function ResourcePanel({ model }: { model: EditorContext }) {
  const { resourceTab, setResourceTab, active, profile, changeItem } = model;
  const select = (id: string | null) => {
    model.setLayerId(id);
    model.setInspectorTab('basic');
    model.setStep(3);
    model.setCropMode(false);
  };
  const addText = (styleId?: string) => {
    if (!active) return;
    const layer = createTextLayer();
    layer.text = 'Seu texto aqui';
    const style = profile.textStyles.find((style) => style.id === styleId);
    if (style) {
      layer.fontFamily = style.fontFamily;
      layer.fontSize = style.fontSize;
      layer.color = style.color;
      layer.background.color = style.backgroundColor;
      layer.stroke = { color: style.strokeColor || '#000000', width: style.strokeWidth || 0 };
    }
    changeItem({ ...active, render: { ...active.render, layers: [...active.render.layers, layer] } });
    select(layer.id);
  };
  return (
    <aside className="resource-panel" aria-label="Recursos do projeto">
      <nav className="resource-tabs" aria-label="Biblioteca">
        {(
          [
            ['media', 'Mídias', Files],
            ['templates', 'Templates', Layers],
            ['text', 'Texto', Type],
          ] as const
        ).map(([tab, label, Icon]) => (
          <button key={tab} aria-pressed={resourceTab === tab} onClick={() => setResourceTab(tab)}>
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
        <ActionMenu
          label="Mais recursos"
          text={resourceTab === 'fonts' ? 'Fontes' : resourceTab === 'presets' ? 'Presets' : 'Mais'}
          icon={<Shapes size={18} />}
        >
          <Button onClick={() => setResourceTab('presets')}>Presets de enquadramento</Button>
          <Button onClick={() => setResourceTab('fonts')}>Fontes da conta</Button>
        </ActionMenu>
      </nav>
      <div className="resource-content" hidden={resourceTab !== 'media'}>
        <ProjectMedia model={model} />
      </div>
      {resourceTab === 'text' && (
        <div className="text-resources">
          <h3>Texto</h3>
          <Button variant="primary" disabled={!active} onClick={() => addText()}>
            <Type size={16} /> Adicionar texto
          </Button>
          <p className="muted tiny">Selecione o texto no player ou na timeline para editar.</p>
          {profile.textStyles.length > 0 && (
            <>
              <h4>Seus estilos</h4>
              {profile.textStyles.map((style) => (
                <Button key={style.id} disabled={!active} onClick={() => addText(style.id)} style={{ fontFamily: style.fontFamily }}>
                  {style.name}
                </Button>
              ))}
            </>
          )}
        </div>
      )}
      <div className="resource-content" hidden={resourceTab === 'media' || resourceTab === 'text'}>
        <Library
          embedded
          view={resourceTab === 'fonts' || resourceTab === 'presets' ? resourceTab : 'templates'}
          store={model.store}
          item={active}
          notify={model.notify}
          kind={model.workspaceKind === 'all' ? active?.kind || 'video' : model.workspaceKind}
          onApplyTemplate={(id, category) => {
            model.onTemplate(id, category);
            if (active) {
              const updated = applyTemplate(active, profile.templates.find((t) => t.id === id) || null, category);
              select(
                category === 'background'
                  ? '@background'
                  : updated.render.layers.find((layer) => layer.id.includes(id || '\0'))?.id || null,
              );
            }
          }}
          onAppendTemplate={(id, category) => {
            if (!active) return;
            const updated = applyTemplate(active, profile.templates.find((t) => t.id === id) || null, category, true);
            changeItem(updated);
            select(updated.render.layers[active.render.layers.length]?.id || null);
          }}
          onApplyPreset={(id) => {
            const preset = profile.framingPresets.find((p) => p.id === id);
            if (preset && active)
              changeItem({
                ...active,
                render: {
                  ...active.render,
                  canvas: canvasForAspect(preset.aspectRatio),
                  media: {
                    ...active.render.media,
                    ...preset.media,
                    source: active.render.media.source,
                    width: active.render.media.width,
                    height: active.render.media.height,
                    type: active.render.media.type,
                  },
                },
              });
          }}
          onSavePreset={() => {
            model.setSaving('preset');
            model.setSaveName('');
          }}
        />
      </div>
    </aside>
  );
}
