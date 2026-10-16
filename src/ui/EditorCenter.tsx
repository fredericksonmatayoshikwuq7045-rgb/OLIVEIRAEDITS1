import { sortMedia } from '../domain/batch';
import { Copy, FolderOpen, Play, Scissors, SlidersHorizontal, Upload, X } from 'lucide-react';
import { isNative } from '../services/native';
import { MediaStrip } from './MediaStrip';
import { PanelBoundary } from './PanelBoundary';
import { Button, IconButton, timecode } from './Primitives';
import { Stage } from './Stage';
import type { EditorContext } from './useEditor';

export function EditorCenter({ model }: { model: EditorContext }) {
  const {
    active,
    project,
    importing,
    importMedia,
    engine,
    previewBusy,
    nativePreview,
    changeItem,
    playing,
    time,
    playTime,
    setPlaying,
    cropMode,
    cropLocked,
    guides,
    safeZone,
    step,
    layerId,
    resolveSource,
    notify,
    importFiles,
    setTime,
    items,
    selectedIds,
    select,
    setSelectedIds,
    selected,
    setBatch,
    applyFraming,
  } = model;
  const exportStates = Object.fromEntries(engine.jobs.flatMap((job) => job.items).map((item) => [item.id, item]));
  return (
    <div className="editor-center">
      <div className="stage-toolbar">
        <div className="row">
          <span className="badge">{active?.kind === 'video' ? 'VÍDEO' : active ? 'IMAGEM' : 'PROJETO'}</span>
          <span className="truncate tiny" style={{ maxWidth: 190 }}>
            {active?.title || project.name}
          </span>
          {importing && <span className="muted tiny">Importando…</span>}
        </div>
        <div className="row">
          <IconButton label="Importar arquivos" onClick={() => void importMedia()}>
            <Upload size={15} />
          </IconButton>
          <IconButton label="Importar pasta" onClick={() => void importMedia(true)}>
            <FolderOpen size={15} />
          </IconButton>
          {active?.kind === 'video' && (
            <IconButton
              label="Prévia real do export (4 segundos)"
              disabled={!isNative() || !engine.info?.available || previewBusy}
              onClick={() => void nativePreview()}
            >
              <Play size={15} />
            </IconButton>
          )}
        </div>
      </div>
      <PanelBoundary name="prévia">
        <Stage
          item={active}
          onChange={changeItem}
          playing={playing}
          time={time}
          onTime={playTime}
          onEnded={() => setPlaying(false)}
          cropMode={cropMode}
          cropLocked={cropLocked}
          guides={guides}
          safeZone={safeZone}
          activeLayerId={step === 3 ? layerId : null}
          onImport={() => void importMedia()}
          resolveSource={resolveSource}
          notify={notify}
          onDropFiles={(files) => void importFiles(files)}
        />
      </PanelBoundary>
      {active?.kind === 'video' && active.status === 'ready' && (
        <div className="timeline">
          <IconButton label={playing ? 'Pausar prévia' : 'Reproduzir prévia'} onClick={() => setPlaying((v) => !v)}>
            {playing ? <span>Ⅱ</span> : <Play size={17} />}
          </IconButton>
          <div className="timeline-track">
            <div className="timeline-times">
              <span className="mono">
                {timecode(Math.max(0, time - active.trim.in))}{' '}
                <span className="muted">/ {timecode((active.trim.out - active.trim.in) / active.speed)}</span>
              </span>
              <span>
                {active.speed}× · {active.probe?.fps ? `${active.probe.fps.toFixed(2)} fps` : ''}
              </span>
            </div>
            <input
              aria-label="Posição de reprodução"
              className="timeline-seek"
              type="range"
              min={active.trim.in}
              max={Math.max(active.trim.in, active.trim.out)}
              step={0.01}
              value={Math.min(active.trim.out, Math.max(active.trim.in, time))}
              onChange={(e) => setTime(Number(e.target.value))}
            />
            <div className="timeline-trims">
              <Scissors size={12} />
              <span>De</span>
              <input
                aria-label="Início do corte"
                type="number"
                min={0}
                max={active.trim.out - 0.001}
                step={0.1}
                value={active.trim.in}
                onChange={(e) =>
                  changeItem({
                    ...active,
                    trim: { ...active.trim, in: Math.max(0, Math.min(Number(e.target.value), active.trim.out - 0.001)) },
                  })
                }
              />
              <span>até</span>
              <input
                aria-label="Fim do corte"
                type="number"
                min={active.trim.in + 0.001}
                max={active.probe?.duration || active.trim.out}
                step={0.1}
                value={active.trim.out}
                onChange={(e) =>
                  changeItem({
                    ...active,
                    trim: {
                      ...active.trim,
                      out: Math.min(active.probe?.duration || Infinity, Math.max(active.trim.in + 0.001, Number(e.target.value))),
                    },
                  })
                }
              />
              <span>segundos</span>
            </div>
          </div>
        </div>
      )}
      <MediaStrip
        items={items}
        exportStates={exportStates}
        onSort={(order) => model.store.updateProject((project) => ({ ...project, items: sortMedia(project.items, order) }))}
        selectedIds={selectedIds}
        activeId={active?.id || null}
        onSelect={select}
        onImport={() => void importMedia()}
        onSelectAll={() => setSelectedIds(items.map((item) => item.id))}
        onSelectUnedited={() =>
          setSelectedIds(
            items
              .filter(
                (item) =>
                  item.render.layers.length === 0 &&
                  item.render.media.zoom === 1 &&
                  item.render.media.pan.x === 0 &&
                  item.render.media.pan.y === 0,
              )
              .map((item) => item.id),
          )
        }
        onSelectErrors={() =>
          setSelectedIds(
            items
              .filter((item) => item.status === 'error' || item.status === 'missing' || exportStates[item.id]?.status === 'error')
              .map((item) => item.id),
          )
        }
      >
        {selected.length > 1 && (
          <div className="batch-bar">
            <strong>{selected.length} selecionadas</strong>
            <Button onClick={() => setBatch(true)}>
              <SlidersHorizontal /> Editar em lote
            </Button>
            <Button onClick={() => applyFraming('selected')}>
              <Copy /> Enquadramento
            </Button>
            <IconButton label="Limpar seleção" onClick={() => setSelectedIds(active ? [active.id] : [])}>
              <X size={14} />
            </IconButton>
          </div>
        )}
      </MediaStrip>
    </div>
  );
}
