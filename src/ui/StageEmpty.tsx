import { Film, FolderOpen, Upload } from 'lucide-react';
import { Button, EmptyState } from './Primitives';
import type { StageProps } from './stageTypes';

export function StageEmpty({
  item,
  onImport,
  onImportFolder,
  importing,
}: Pick<StageProps, 'item' | 'onImport' | 'onImportFolder' | 'importing'>) {
  return (
    <EmptyState
      icon={<Film size={28} />}
      title={item?.status === 'missing' ? 'Arquivo não encontrado' : 'Seu próximo post começa aqui'}
      description={
        item?.status === 'missing'
          ? 'O arquivo original foi movido ou está indisponível. Re-vincule a mídia para continuar.'
          : item?.error || 'Escolha uma pasta para preencher os slots de uma vez, ou selecione vídeos e imagens.'
      }
      action={
        <div className="row">
          <Button variant="primary" disabled={importing} onClick={onImportFolder}>
            <FolderOpen /> Importar pasta
          </Button>
          <Button disabled={importing} onClick={onImport}>
            <Upload /> Importar arquivos
          </Button>
        </div>
      }
    />
  );
}
