import { FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw, Save } from 'lucide-react';
import { useState } from 'react';
import { canvasForAspect } from '../domain/defaults';
import type { AspectRatio, MediaItem, Profile } from '../domain/models';
import type { FitMode, RenderMedia } from '../render/types';
import { detectBlackBars, isNative } from '../services/native';
import { Button, Field, Section, Slider, Toggle } from './Primitives';
const fits: [FitMode, string][] = [
  ['cover', 'Preencher'],
  ['contain', 'Caber'],
  ['stretch', 'Esticar'],
  ['original', 'Original'],
  ['blur', 'Fundo desfocado'],
];
export function FramingProperties({
  item,
  profile,
  onChange,
  onApply,
  onSavePreset,
  cropMode,
  onCropMode,
  guides,
  onGuides,
  safeZone,
  onSafeZone,
  cropLocked,
  onCropLocked,
}: {
  item: MediaItem;
  profile: Profile;
  onChange: (item: MediaItem) => void;
  onApply: (target: 'all' | 'selected') => void;
  onSavePreset: () => void;
  cropMode: boolean;
  onCropMode: (v: boolean) => void;
  guides: boolean;
  onGuides: (v: boolean) => void;
  safeZone: boolean;
  onSafeZone: (v: boolean) => void;
  cropLocked: boolean;
  onCropLocked: (v: boolean) => void;
}) {
  const [detecting, setDetecting] = useState(false),
    [detection, setDetection] = useState('');
  const detect = async () => {
    setDetecting(true);
    try {
      const crop = await detectBlackBars(item, profile);
      if (crop) onChange({ ...item, render: { ...item.render, media: { ...item.render.media, crop } } });
      setDetection(crop ? 'Barras detectadas e recorte aplicado.' : 'Nenhuma barra detectada nesta amostra.');
    } catch (error) {
      setDetection(String(error));
    } finally {
      setDetecting(false);
    }
  };
  const media = item.render.media;
  const patch = (change: Partial<RenderMedia>) => onChange({ ...item, render: { ...item.render, media: { ...media, ...change } } });
  const aspect = `${item.render.canvas.width / item.render.canvas.height}`;
  return (
    <>
      <Section title="Formato e ajuste">
        <Field label="Proporção de saída">
          <select
            aria-label="Proporção de saída"
            value={
              (['9:16', '16:9', '1:1', '4:5'] as AspectRatio[]).find((r) => {
                const [w, h] = r.split(':').map(Number);
                return Math.abs(w / h - Number(aspect)) < 0.01;
              }) || profile.aspectRatio
            }
            onChange={(e) => onChange({ ...item, render: { ...item.render, canvas: canvasForAspect(e.target.value as AspectRatio) } })}
          >
            {['9:16', '16:9', '1:1', '4:5'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <div className="property-modes">
          {fits.map(([fit, label]) => (
            <button key={fit} className={media.fit === fit ? 'active' : ''} onClick={() => patch({ fit })}>
              {label}
            </button>
          ))}
        </div>
        {media.fit === 'stretch' && <small className="notice">Esticar pode deformar a imagem.</small>}
        <Slider label="Zoom" value={media.zoom} min={0.1} max={5} step={0.01} suffix="×" onChange={(zoom) => patch({ zoom })} />
        <div className="form-grid">
          <Field label="Posição X (%)">
            <input
              type="number"
              step={0.1}
              min={-200}
              max={200}
              value={Number((media.pan.x * 100).toFixed(1))}
              onChange={(e) => patch({ pan: { ...media.pan, x: Number(e.target.value) / 100 } })}
            />
          </Field>
          <Field label="Posição Y (%)">
            <input
              type="number"
              step={0.1}
              min={-200}
              max={200}
              value={Number((media.pan.y * 100).toFixed(1))}
              onChange={(e) => patch({ pan: { ...media.pan, y: Number(e.target.value) / 100 } })}
            />
          </Field>
        </div>
      </Section>
      <Section title="Recorte visual">
        <Toggle label="Editar caixa de recorte" checked={cropMode} onChange={onCropMode} />
        <Toggle
          label="Travar proporção do recorte"
          checked={cropLocked}
          onChange={onCropLocked}
          hint="Usa a proporção de saída selecionada."
        />
        <Toggle label="Regra dos terços e centro" checked={guides} onChange={onGuides} />
        <Toggle label="Área segura para redes sociais" checked={safeZone} onChange={onSafeZone} />
        <small>Arraste cantos e bordas. O enquadramento encaixa no centro; as setas fazem ajustes finos.</small>
        <Button disabled={!isNative() || item.kind !== 'video' || detecting} onClick={() => void detect()}>
          {detecting ? 'Analisando…' : 'Detectar barras pretas'}
        </Button>
        {detection && <small role="status">{detection}</small>}
        <Button onClick={() => patch({ crop: { x: 0, y: 0, width: 1, height: 1 } })}>Limpar recorte</Button>
      </Section>
      <Section title="Transformação">
        <Slider label="Rotação" value={media.rotation} min={-180} max={180} suffix="°" onChange={(rotation) => patch({ rotation })} />
        <div className="property-buttons">
          <Button title="Girar 90 graus" onClick={() => patch({ rotation: (media.rotation + 90) % 360 })}>
            <RotateCw size={13} /> 90°
          </Button>
          <Button title="Espelhar horizontalmente" onClick={() => patch({ flipH: !media.flipH })}>
            <FlipHorizontal2 size={14} />
          </Button>
          <Button title="Espelhar verticalmente" onClick={() => patch({ flipV: !media.flipV })}>
            <FlipVertical2 size={14} />
          </Button>
        </div>
        <Toggle
          label="Máscara circular"
          checked={media.mask === 'circle'}
          onChange={(circle) => patch({ mask: circle ? 'circle' : 'none' })}
        />
        <Slider label="Opacidade da mídia" value={media.opacity} min={0} max={1} step={0.01} onChange={(opacity) => patch({ opacity })} />
        <Button
          onClick={() =>
            patch({
              zoom: 1,
              pan: { x: 0, y: 0 },
              rotation: 0,
              flipH: false,
              flipV: false,
              mask: 'none',
              crop: { x: 0, y: 0, width: 1, height: 1 },
            })
          }
        >
          <RotateCcw /> Resetar enquadramento
        </Button>
      </Section>
      <Section title="Aplicar em lote">
        <small>O enquadramento é relativo à resolução de cada mídia.</small>
        <Button onClick={() => onApply('selected')}>Aplicar a selecionadas</Button>
        <Button onClick={() => onApply('all')}>Aplicar a todas</Button>
        <Button variant="ghost" onClick={onSavePreset}>
          <Save /> Salvar como preset da conta
        </Button>
      </Section>
    </>
  );
}
