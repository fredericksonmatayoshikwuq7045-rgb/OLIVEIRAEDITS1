import type { MediaItem } from '../domain/models';
import type { RenderBackground } from '../render/types';
import { Field, Section, Slider, Toggle } from './Primitives';

export function BackgroundProperties({ item, onChange }: { item: MediaItem; onChange: (item: MediaItem) => void }) {
  const background = item.render.background;
  const change = (value: RenderBackground) => onChange({ ...item, render: { ...item.render, background: value } });
  return (
    <Section title="Fundo" defaultOpen={false}>
      <Field label="Tipo de fundo">
        <select
          value={background.type}
          onChange={(event) => {
            const type = event.target.value;
            if (type === 'solid') change({ type, color: '#111111' });
            if (type === 'gradient') change({ type, from: '#111111', to: '#8a2030', angle: 90 });
            if (type === 'blur') change({ type, radius: 0.025 });
          }}
        >
          <option value="solid">Cor sólida</option>
          <option value="gradient">Gradiente</option>
          <option value="blur">Vídeo / imagem desfocada</option>
          {(background.type === 'image' || background.type === 'video') && (
            <option value={background.type}>Template de {background.type === 'video' ? 'vídeo' : 'imagem'}</option>
          )}
        </select>
      </Field>
      {background.type === 'solid' && (
        <Field label="Cor do fundo">
          <input type="color" value={background.color} onChange={(event) => change({ ...background, color: event.target.value })} />
        </Field>
      )}
      {background.type === 'gradient' && (
        <>
          <Field label="Cor inicial">
            <input type="color" value={background.from} onChange={(event) => change({ ...background, from: event.target.value })} />
          </Field>
          <Field label="Cor final">
            <input type="color" value={background.to} onChange={(event) => change({ ...background, to: event.target.value })} />
          </Field>
          <Slider
            label="Ângulo do gradiente"
            value={background.angle}
            min={0}
            max={360}
            suffix="°"
            onChange={(angle) => change({ ...background, angle })}
          />
        </>
      )}
      {background.type === 'blur' && (
        <Slider
          label="Intensidade do desfoque"
          min={0.001}
          max={0.1}
          step={0.001}
          value={background.radius}
          onChange={(radius) => change({ ...background, radius })}
        />
      )}
      {(background.type === 'image' || background.type === 'video') && (
        <Slider
          label="Opacidade do fundo"
          min={0}
          max={1}
          step={0.01}
          value={background.opacity}
          onChange={(opacity) => change({ ...background, opacity })}
        />
      )}
      {background.type === 'video' && (
        <Toggle
          label="Misturar áudio do fundo com a mídia"
          checked={background.audio === 'mix'}
          onChange={(mix) => change({ ...background, audio: mix ? 'mix' : 'mute' })}
          hint="Por padrão, somente o áudio da mídia principal é usado."
        />
      )}
      <small>Para usar imagem ou vídeo, aplique um template na categoria Fundo da biblioteca.</small>
    </Section>
  );
}
