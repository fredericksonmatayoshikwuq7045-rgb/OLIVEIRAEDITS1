import { sortMedia } from '../domain/batch';
import { Copy, SlidersHorizontal, X } from 'lucide-react';
import { MediaStrip } from './MediaStrip';
import { MediaAreas } from './MediaAreas';
import { Button, IconButton } from './Primitives';
import type { EditorContext } from './useEditor';
export function ProjectMedia({ model }: { model: EditorContext }) {
  const { items, engine, active, selectedIds, select, selected, setSelectedIds, setBatch, applyFraming, importing, importMedia } = model;
  const exportStates = Object.fromEntries(engine.jobs.flatMap((job) => job.items).map((item) => [item.id, item]));
  return (
    <div className="project-media">
      <MediaAreas model={model} />
      {importing && (
        <div className="import-status" role="status">
          {model.importProgress ? `Importando ${model.importProgress.completed}/${model.importProgress.total}…` : 'Selecionando mídias…'}
        </div>
      )}
      <MediaStrip
        items={items}
        grid
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
        onClear={model.requestClear}
        clearingDisabled={model.previewBusy}
        clearCount={model.allItems.length}
        kind={model.workspaceKind}
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
