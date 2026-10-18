import { FolderOpen, RefreshCw } from 'lucide-react';
import { chooseOutputDirectory, clearGeneratedCache, isNative, openLogs } from '../services/native';
import type { WorkspaceStore } from './Dashboard';
import { Button, Field, Modal, Section, Toggle } from './Primitives';
import type { EngineState } from './useEngine';
import type { UiSettings } from '../domain/preferences';
export type { UiSettings } from '../domain/preferences';
export function Settings({
  store,
  engine,
  settings,
  onSettings,
  onClose,
  notify,
}: {
  store: WorkspaceStore;
  engine: EngineState;
  settings: UiSettings;
  onSettings: (value: UiSettings) => void;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const profile = store.profile;
  return (
    <Modal title="Configurações" onClose={onClose}>
      <div className="stack">
        <Section title="Motor de exportação">
          <div className="row-between">
            <strong className={engine.info?.available ? 'success-message' : 'muted'}>
              {engine.info?.available ? 'FFmpeg e FFprobe disponíveis' : isNative() ? 'FFmpeg indisponível' : 'Modo navegador'}
            </strong>
            <Button onClick={() => void engine.refresh()}>
              <RefreshCw /> Verificar
            </Button>
          </div>
          {engine.info?.version && <small className="mono">{engine.info.version}</small>}
          {engine.info?.ffmpegPath && <small className="mono">{engine.info.ffmpegPath}</small>}
          {engine.info?.warnings.map((message) => (
            <div className="notice" key={message}>
              {message}
            </div>
          ))}
          {engine.error && <div className="error-message">{engine.error}</div>}
          <small>
            Instale os sidecars em src-tauri/binaries conforme docs/setup-ffmpeg.md. A renderização de vídeo fica bloqueada enquanto o motor
            estiver indisponível.
          </small>
          <Field label="Concorrência de exportação">
            <select value={settings.concurrency} onChange={(e) => onSettings({ ...settings, concurrency: Number(e.target.value) })}>
              {[1, 2, 3].map((n) => (
                <option value={n} key={n}>
                  {n} {n === 1 ? 'arquivo por vez (recomendado para CPU)' : 'arquivos simultâneos'}
                </option>
              ))}
            </select>
          </Field>
          <small>Use 1 com libx264. Aumente somente quando houver memória e capacidade de hardware.</small>
        </Section>
        {profile && (
          <Section title={`Exportação de ${profile.name}`}>
            <Field label="Pasta de saída da conta">
              <div className="row">
                <input
                  value={profile.exportSettings.outputDir}
                  onChange={(e) => store.updateProfile({ exportSettings: { ...profile.exportSettings, outputDir: e.target.value } })}
                  placeholder="Escolha uma pasta no aplicativo"
                />
                <IconButtonFolder
                  onClick={async () => {
                    try {
                      const outputDir = await chooseOutputDirectory(profile.exportSettings.outputDir);
                      if (outputDir) store.updateProfile({ exportSettings: { ...profile.exportSettings, outputDir } });
                    } catch (error) {
                      notify(String(error));
                    }
                  }}
                />
              </div>
            </Field>
            <Field label="Encoder preferido">
              <select
                value={profile.exportSettings.encoder}
                onChange={(e) =>
                  store.updateProfile({
                    exportSettings: { ...profile.exportSettings, encoder: e.target.value as typeof profile.exportSettings.encoder },
                  })
                }
              >
                {[
                  'libx264',
                  ...(engine.info?.encoders.filter((encoder) => ['h264_nvenc', 'h264_qsv', 'h264_amf'].includes(encoder)) || []),
                ].map((encoder) => (
                  <option key={encoder}>{encoder}</option>
                ))}
              </select>
            </Field>
            <Toggle
              label="Limpar metadados ao exportar"
              checked={profile.exportSettings.cleanMetadata}
              onChange={(cleanMetadata) => store.updateProfile({ exportSettings: { ...profile.exportSettings, cleanMetadata } })}
            />
          </Section>
        )}
        <Section title="Aplicativo">
          <div className="row-between">
            <span>Idioma</span>
            <span className="muted">Português (Brasil)</span>
          </div>
          <div className="row-between">
            <span>Tema</span>
            <span className="muted">Escuro · Oliveira vermelho</span>
          </div>
          <Button disabled={!isNative()} onClick={() => void openLogs().catch((error) => notify(String(error)))}>
            <FolderOpen /> Abrir pasta de logs
          </Button>
          <Button
            disabled={!isNative()}
            onClick={() =>
              void clearGeneratedCache()
                .then(() => notify('Prévias e miniaturas removidas do cache. Projetos e arquivos originais foram preservados.'))
                .catch((error) => notify(String(error)))
            }
          >
            Limpar prévias e miniaturas
          </Button>
          <small>Os logs não incluem valores de credenciais. A limpeza de temporários órfãos acontece na inicialização do motor.</small>
        </Section>
      </div>
    </Modal>
  );
}
function IconButtonFolder({ onClick }: { onClick: () => void }) {
  return (
    <Button title="Escolher pasta de saída" disabled={!isNative()} onClick={onClick}>
      <FolderOpen size={15} />
    </Button>
  );
}
