import { sortMedia } from '../domain/batch';
import { Copy, FolderOpen, Play, SlidersHorizontal, Upload, X } from 'lucide-react';
import { isNative } from '../services/native';
import { MediaStrip } from './MediaStrip';
import { PanelBoundary } from './PanelBoundary';
import { Button, IconButton } from './Primitives';
import { VideoTimeline } from './VideoTimeline';
import { Stage } from './Stage';
import type { EditorContext } from './useEditor';

export function EditorCenter({ model }: { model: EditorContext }) {
  const {
    active,
    project,
    importing,
    importProgress,
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
          {importing && (
            <span className="muted tiny" role="status">
              {importProgress ? `Importando ${importProgress.completed}/${importProgress.total}…` : 'Selecionando mídias…'}
            </span>
          )}
        </div>
        <div className="row">
          <IconButton label="Importar arquivos" disabled={importing} onClick={() => void importMedia()}>
            <Upload size={15} />
          </IconButton>
          <IconButton label="Importar pasta" disabled={importing} onClick={() => void importMedia(true)}>
            <FolderOpen size={15} />
          </IconButton>
          {active && (
            <Button aria-pressed={model.compare} onClick={() => model.setCompare((value) => !value)}>
              {model.compare ? 'Ver edição' : 'Ver original'}
            </Button>
          )}
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
          compare={model.compare}
          onSelectLayer={step === 3 ? model.setLayerId : undefined}
          onContextMenu={(event) => {
            if (active) {
              event.preventDefault();
              model.setMenu({ x: event.clientX, y: event.clientY, item: active });
            }
          }}
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
          onImportFolder={() => void importMedia(true)}
          importing={importing}
          resolveSource={resolveSource}
          notify={notify}
          onDropFiles={(files) => {
            if (!isNative()) void importFiles(files);
          }}
        />
      </PanelBoundary>
      {active?.kind === 'video' && active.status === 'ready' && (
        <VideoTimeline
          item={active}
          profile={model.profile}
          time={time}
          playing={playing}
          onTime={setTime}
          onPlay={() => setPlaying((value) => !value)}
          onChange={changeItem}
          onSplit={model.split}
          performance={model.settings.performance}
        />
      )}
      <MediaStrip
        items={items}
        grid={model.settings.layout === 'right'}
        onContextMenu={(event, item) => {
          event.preventDefault();
          model.setMenu({ x: event.clientX, y: event.clientY, item });
        }}
        exportStates={exportStates}
        onSort={(order) => model.store.updateProject((project) => ({ ...project, items: sortMedia(project.items, order) }))}
        selectedIds={selectedIds}
        activeId={active?.id || null}
        onSelect={select}
        onImport={() => void importMedia()}
        onImportFolder={() => void importMedia(true)}
        importing={importing}
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
