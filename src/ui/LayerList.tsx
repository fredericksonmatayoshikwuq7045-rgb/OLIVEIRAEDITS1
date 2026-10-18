import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import type { MediaItem, Profile } from '../domain/models';
import { createTextLayer, type RenderLayer } from '../render/types';
import { BACKGROUND_TRACK, trackName } from '../domain/timeline';
import { Button, IconButton, Section } from './Primitives';
export function LayerList({
  item,
  profile,
  selectedId,
  onSelect,
  onReplace,
}: {
  item: MediaItem;
  profile: Profile;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onReplace: (layers: RenderLayer[]) => void;
}) {
  const layers = item.render.layers;
  return (
    <Section title="Camadas">
      <Button
        variant="primary"
        onClick={() => {
          const layer = createTextLayer();
          layer.text = 'Seu texto aqui';
          onReplace([...layers, layer]);
          onSelect(layer.id);
        }}
      >
        <Plus /> Adicionar texto
      </Button>
      <div className="stack" style={{ gap: 6 }}>
        <div className={`layer-row ${selectedId === BACKGROUND_TRACK ? 'active' : ''}`}>
          <button aria-label="Selecionar fundo nas propriedades" onClick={() => onSelect(BACKGROUND_TRACK)}>
            {trackName(item, BACKGROUND_TRACK, profile)}
          </button>
        </div>
        {[...layers]
          .sort((a, b) => b.zIndex - a.zIndex)
          .map((layer) => (
            <div className={`layer-row ${layer.id === selectedId ? 'active' : ''}`} key={layer.id}>
              <button onClick={() => onSelect(layer.id)}>{trackName(item, layer.id, profile)}</button>
              <IconButton
                label="Mostrar ou ocultar camada"
                onClick={() => onReplace(layers.map((l) => (l.id === layer.id ? { ...l, visible: !l.visible } : l)))}
              >
                {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </IconButton>
              <IconButton
                label="Remover camada"
                onClick={() => {
                  onReplace(layers.filter((l) => l.id !== layer.id));
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
  );
}
