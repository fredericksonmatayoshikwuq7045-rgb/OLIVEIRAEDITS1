import { Download, FolderOpen } from 'lucide-react';
import { outputFilename } from '../domain/batch';
import type { Profile } from '../domain/models';
import { chooseOutputDirectory, isNative, type FinishAction } from '../services/native';
import { Button, Field, Toggle } from './Primitives';
import type { ExportDialogContext } from './useExportDialog';

export function ExportSetup({ model }: { model: ExportDialogContext }) {
  const {
    ready,
    profile,
    items,
    metadata,
    setMetadata,
    deep,
    setDeep,
    moving,
    setMoving,
    engine,
    patch,
    setError,
    sample,
    hasVideo,
    finishAction,
    setFinishAction,
    available,
    onClose,
    busy,
    run,
  } = model;
  return (
    <div className="stack">
      <div className="notice">
        <strong>{ready.length} mídias</strong> da conta <strong>{profile.name}</strong>.{' '}
        {items.length - ready.length > 0 && `${items.length - ready.length} itens indisponíveis serão ignorados.`} Confira a pasta e o nome
        antes de iniciar.
      </div>
      <Toggle label="Só limpar metadados (sem aplicar edições)" checked={metadata} onChange={setMetadata} />
      {metadata && (
        <>
          <p className="muted">Limpar metadados não altera o conteúdo visual ou sonoro e não impede a detecção de conteúdo duplicado.</p>
          <Toggle label="Limpeza profunda com reencode" checked={deep} onChange={setDeep} />
          <Toggle
            label="Mover originais após verificar a limpeza"
            checked={moving}
            onChange={setMoving}
            hint="Desativado: mantém os originais no local atual."
          />
          <small>
            {engine.info?.exiftoolAvailable
              ? 'ExifTool detectado para uma segunda passada.'
              : 'ExifTool não detectado. O FFmpeg fará a limpeza e a verificação das tags remanescentes.'}
          </small>
        </>
      )}
      <Field label="Pasta de saída">
        <div className="row">
          <input
            value={profile.exportSettings.outputDir}
            onChange={(e) => patch({ outputDir: e.target.value })}
            placeholder={isNative() ? 'Selecione uma pasta' : 'Imagens serão baixadas pelo navegador'}
          />
          <Button
            disabled={!isNative()}
            onClick={() =>
              void chooseOutputDirectory(profile.exportSettings.outputDir)
                .then((path) => {
                  if (path) patch({ outputDir: path });
                })
                .catch((reason) => setError(String(reason)))
            }
          >
            <FolderOpen /> Escolher
          </Button>
        </div>
      </Field>
      <Field label="Padrão do nome" hint="{conta}, {slot}, {n}, {data}, {hora}, {original}, {aspect}">
        <input value={profile.exportSettings.filenamePattern} onChange={(e) => patch({ filenamePattern: e.target.value })} />
      </Field>
      {sample && (
        <small>
          Exemplo:{' '}
          <span className="mono">
            {outputFilename(
              profile.exportSettings.filenamePattern,
              {
                conta: profile.name,
                slot: sample.slot,
                n: 1,
                original: sample.title,
                aspect: `${sample.render.canvas.width}x${sample.render.canvas.height}`,
              },
              sample.kind === 'video' ? 'mp4' : profile.exportSettings.imageFormat === 'jpeg' ? 'jpg' : profile.exportSettings.imageFormat,
            )}
          </span>
        </small>
      )}
      <div className="form-grid">
        <Field label="Qualidade do vídeo">
          <select
            value={profile.exportSettings.preset}
            onChange={(e) => patch({ preset: e.target.value as Profile['exportSettings']['preset'] })}
          >
            <option value="fast">Rápido · CRF 23 / veryfast</option>
            <option value="standard">Padrão · CRF 21 / fast</option>
            <option value="high">Alta · CRF 18 / medium</option>
            <option value="nvenc" disabled={!engine.info?.encoders.includes('h264_nvenc')}>
              NVENC · CQ 21 / p5
            </option>
          </select>
        </Field>
        <Field label="Conflito de nome">
          <select
            value={profile.exportSettings.conflict}
            onChange={(e) => patch({ conflict: e.target.value as Profile['exportSettings']['conflict'] })}
          >
            <option value="suffix">Adicionar sufixo</option>
            <option value="skip">Pular existente</option>
            <option value="overwrite">Sobrescrever</option>
          </select>
        </Field>
        <Field label="Formato das imagens">
          <select
            value={profile.exportSettings.imageFormat}
            onChange={(e) => patch({ imageFormat: e.target.value as Profile['exportSettings']['imageFormat'] })}
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPG</option>
            <option value="webp">WebP</option>
          </select>
        </Field>
        <Field label="Qualidade JPG / WebP (%)">
          <input
            type="number"
            min={1}
            max={100}
            value={Math.round(profile.exportSettings.imageQuality * 100)}
            onChange={(e) => patch({ imageQuality: Math.max(0.01, Math.min(1, Number(e.target.value) / 100)) })}
          />
        </Field>
      </div>
      {isNative() && hasVideo && !metadata && (
        <Field label="Ao concluir sem falhas (Windows)">
          <select value={finishAction} onChange={(e) => setFinishAction(e.target.value as FinishAction)}>
            <option value="none">Manter computador ligado</option>
            <option value="shutdown">Desligar em 60 segundos</option>
            <option value="hibernate">Hibernar</option>
          </select>
          <small>Exige confirmação neste lote; após reiniciar o aplicativo, a ação volta a manter ligado.</small>
        </Field>
      )}
      <Toggle
        label="Limpar metadados ao exportar"
        checked={profile.exportSettings.cleanMetadata}
        onChange={(cleanMetadata) => patch({ cleanMetadata })}
      />
      {!available && (
        <div className="notice">
          {isNative()
            ? 'FFmpeg ou FFprobe não encontrado. Confira os sidecars em Configurações antes de exportar.'
            : 'Renderização de vídeo e limpeza de metadados exigem o aplicativo desktop com FFmpeg. Nenhum vídeo original será baixado como se estivesse editado.'}
        </div>
      )}
      <div className="form-actions">
        <Button onClick={onClose}>Voltar à edição</Button>
        <Button
          variant="primary"
          disabled={busy || !ready.length || !available || (isNative() && !profile.exportSettings.outputDir.trim())}
          onClick={() => void run()}
        >
          <Download />
          {busy ? 'Preparando lote…' : metadata ? `Limpar ${ready.length} arquivos` : `Exportar ${ready.length} mídias`}
        </Button>
      </div>
    </div>
  );
}
