import { Eye, Play, SkipBack, SkipForward } from 'lucide-react';
import { compositionDuration, outputTime, playerTime } from '../domain/timeline';
import { isNative } from '../services/native';
import { ActionMenu } from './ActionMenu';
import { Button, IconButton, timecode } from './Primitives';
import type { EditorContext } from './useEditor';
export function PlayerTransport({ model }: { model: EditorContext }) {
  const { active, playing, time } = model;
  if (!active) return null;
  const at = outputTime(active, time),
    duration = compositionDuration(active),
    step = 1 / (active.probe?.fps || 30);
  const seek = (value: number, commit = false) => {
    model.setPlaying(false);
    model.setTime(playerTime(active, Math.max(0, Math.min(duration - 0.001, value))));
    if (commit && active.kind === 'image') model.changeItem({ ...active, imageTime: Math.max(0, Math.min(duration - 0.001, value)) });
  };
  return (
    <div className="player-transport">
      <input
        className="player-scrubber"
        type="range"
        aria-label={active.kind === 'image' ? 'Quadro da imagem' : 'Posição na composição'}
        min={0}
        max={duration - 0.001}
        step={step}
        value={Math.max(0, Math.min(duration - 0.001, at))}
        onChange={(event) => seek(Number(event.target.value))}
        onPointerUp={(event) => seek(Number(event.currentTarget.value), true)}
        onKeyUp={(event) => seek(Number(event.currentTarget.value), true)}
      />
      <div className="transport-line">
        <span className="mono transport-time">
          {timecode(Math.max(0, at))}
          <span> / {timecode(duration)}</span>
        </span>
        <div className="transport-play">
          <IconButton label="Voltar um quadro" onClick={() => seek(at - step, true)}>
            <SkipBack size={14} />
          </IconButton>
          <IconButton
            label={
              active.kind === 'image'
                ? playing
                  ? 'Pausar composição'
                  : 'Reproduzir composição'
                : playing
                  ? 'Pausar prévia'
                  : 'Reproduzir prévia'
            }
            onClick={model.togglePlayback}
          >
            {playing ? 'Ⅱ' : <Play size={18} fill="currentColor" />}
          </IconButton>
          <IconButton label="Avançar um quadro" onClick={() => seek(at + step, true)}>
            <SkipForward size={14} />
          </IconButton>
        </div>
        <div className="row">
          <IconButton
            label={model.compare ? 'Ver edição' : 'Ver original'}
            aria-pressed={model.compare}
            onClick={() => model.setCompare((value) => !value)}
          >
            <Eye size={15} />
          </IconButton>
          <ActionMenu label="Opções do player">
            <Button
              disabled={active.kind !== 'video' || !isNative() || !model.engine.info?.available || model.previewBusy}
              onClick={() => void model.nativePreview()}
            >
              Prévia real do export (4 segundos)
            </Button>
            <Button
              disabled={!isNative() || !model.engine.info?.available || model.previewBusy}
              onClick={() => void model.nativePreview(true)}
            >
              Prévia real de um quadro
            </Button>
            <Button onClick={() => model.setGuides(!model.guides)}>{model.guides ? 'Ocultar' : 'Mostrar'} guias de alinhamento</Button>
            <Button onClick={() => model.setSafeZone(!model.safeZone)}>{model.safeZone ? 'Ocultar' : 'Mostrar'} área segura</Button>
          </ActionMenu>
        </div>
      </div>
    </div>
  );
}
