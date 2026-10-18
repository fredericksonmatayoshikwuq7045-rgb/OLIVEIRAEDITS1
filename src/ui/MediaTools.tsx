import { ChevronDown, FolderOpen, Plus, Trash2 } from 'lucide-react';
import type { MediaSort } from '../domain/batch';
import { ActionMenu } from './ActionMenu';
import { Button, Field } from './Primitives';
export function MediaTools({
  title,
  open,
  onToggle,
  importing,
  onImport,
  onImportFolder,
  onClear,
  clearDisabled,
  onSort,
  onSelectAll,
  onSelectUnedited,
  onSelectErrors,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  importing: boolean;
  onImport: () => void;
  onImportFolder: () => void;
  onClear: () => void;
  clearDisabled: boolean;
  onSort: (order: MediaSort) => void;
  onSelectAll: () => void;
  onSelectUnedited: () => void;
  onSelectErrors: () => void;
}) {
  return (
    <div className="media-strip-heading">
      <div className="media-heading-line">
        <h3>{title}</h3>
        <ActionMenu label="Opções das mídias">
          <Button disabled={importing} onClick={onImportFolder}>
            <FolderOpen size={14} /> Importar pasta
          </Button>
          <Field label="Ordenar mídias">
            <select
              aria-label="Ordenar mídias"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) onSort(event.target.value as MediaSort);
              }}
            >
              <option value="">Ordenar…</option>
              <option value="name">Nome</option>
              <option value="date">Data</option>
              <option value="size">Tamanho</option>
            </select>
          </Field>
          <Field label="Selecionar mídias">
            <select
              aria-label="Selecionar mídias"
              value=""
              onChange={(event) => {
                if (event.target.value === 'all') onSelectAll();
                if (event.target.value === 'unedited') onSelectUnedited();
                if (event.target.value === 'errors') onSelectErrors();
              }}
            >
              <option value="">Selecionar…</option>
              <option value="all">Todas</option>
              <option value="unedited">Sem edição</option>
              <option value="errors">Com erro / ausente</option>
            </select>
          </Field>
          <Button onClick={onToggle}>
            <ChevronDown size={14} />
            {open ? 'Recolher mídias' : 'Expandir mídias'}
          </Button>
          <Button className="danger-text" aria-label="Limpar todas as mídias" disabled={clearDisabled} onClick={onClear}>
            <Trash2 size={14} /> Limpar todas
          </Button>
        </ActionMenu>
      </div>
      <Button variant="primary" aria-label="Importar arquivos" disabled={importing} onClick={onImport}>
        <Plus size={15} /> Importar
      </Button>
    </div>
  );
}
