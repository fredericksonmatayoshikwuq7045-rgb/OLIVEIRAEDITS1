import { useEffect, useRef, useState } from 'react';
import { coverMark, normalizeMarkRule, type MarkRule } from '../domain/automation';
import type { MediaItem } from '../domain/models';
import { analyzeMedia, type AnalysisResult } from '../services/analysis';
import { Button, Field, Modal, Toggle } from './Primitives';
import type { EditorContext } from './useEditor';
export function AutomationPanel({ model, onClose }: { model: EditorContext; onClose: () => void }) {
  const [type, setType] = useState<'crop' | 'mark'>('crop'),
    [rule, setRule] = useState<MarkRule>(normalizeMarkRule(model.profile.markRule));
  const [results, setResults] = useState<AnalysisResult[]>([]),
    [progress, setProgress] = useState({ completed: 0, total: 0 }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const controller = useRef<AbortController | null>(null),
    snapshot = useRef(new Map<string, string>());
  const targets = (model.selected.length ? model.selected : model.items).filter((item) => item.status === 'ready');
  useEffect(() => () => controller.current?.abort(), []);
  const reset = () => {
    setResults([]);
    setError('');
  };
  const patch = (value: Partial<MarkRule>) => {
    setRule((previous) => ({ ...previous, ...value }));
    reset();
  };
  const analyze = async () => {
    setBusy(true);
    reset();
    const operation = new AbortController();
    controller.current = operation;
    snapshot.current = new Map(
      targets.map((item) => [
        item.id,
        JSON.stringify({ source: item.sourcePath || item.assetId, render: item.render, trim: item.trim, speed: item.speed }),
      ]),
    );
    try {
      setResults(
        await analyzeMedia(targets, model.profile, type, rule, operation.signal, (completed, total) => setProgress({ completed, total })),
      );
    } catch (error) {
      setError(operation.signal.aborted ? 'Análise cancelada. Nenhuma edição foi aplicada.' : String(error));
    } finally {
      if (controller.current === operation) {
        controller.current = null;
        setBusy(false);
      }
    }
  };
  const apply = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = rule.color;
      ctx.fillRect(0, 0, 1, 1);
      const plate = canvas.toDataURL('image/png');
      const template = model.profile.templates.find((value) => value.id === rule.replacementTemplateId);
      if (type === 'mark' && !template && !rule.replacementText.trim()) throw new Error('Informe sua marca em texto ou escolha uma logo.');
      const updated: MediaItem[] = [];
      for (const result of results.filter((value) => value.selected && value.rect)) {
        const item = model.items.find((value) => value.id === result.id);
        if (!item) throw new Error('Uma mídia foi removida. Analise novamente.');
        if (
          snapshot.current.get(item.id) !==
          JSON.stringify({ source: item.sourcePath || item.assetId, render: item.render, trim: item.trim, speed: item.speed })
        )
          throw new Error(`${item.title} foi alterada depois da análise. Analise novamente para preservar suas edições.`);
        updated.push(
          type === 'crop'
            ? {
                ...item,
                render: { ...item.render, media: { ...item.render.media, crop: result.rect!, fit, zoom: 1, pan: { x: 0, y: 0 } } },
              }
            : coverMark(
                item,
                result.rect!,
                rule,
                plate,
                template ? { source: template.source, width: template.sourceWidth || 1, height: template.sourceHeight || 1 } : undefined,
              ),
        );
      }
      if (!updated.length) throw new Error('Selecione ao menos uma detecção para aplicar.');
      if (type === 'mark') model.store.updateProfile({ markRule: rule });
      model.applyUpdated(updated);
      onClose();
    } catch (error) {
      setError(String(error));
    }
  };
  return (
    <Modal
      title="Assistente de recorte e marcas"
      wide
      onClose={() => {
        controller.current?.abort();
        onClose();
      }}
    >
      <div className="stack">
        <Field label="O que analisar">
          <select
            disabled={busy}
            value={type}
            onChange={(event) => {
              setType(event.target.value as typeof type);
              reset();
            }}
          >
            <option value="crop">Área real da mídia · remover moldura</option>
            <option value="mark">Localizar marca antiga e cobrir com a minha</option>
          </select>
        </Field>
        <p className="muted">
          Análise local de {targets.length} mídia(s). Vídeos usam cinco amostras do trecho selecionado. Apenas detecções consistentes são
          selecionadas automaticamente; confira a prévia antes de aplicar.
        </p>
        {type === 'crop' ? (
          <Field label="Encaixe após o recorte">
            <select disabled={busy} value={fit} onChange={(event) => setFit(event.target.value as typeof fit)}>
              <option value="contain">Mostrar toda a cena</option>
              <option value="cover">Preencher o quadro</option>
            </select>
          </Field>
        ) : (
          <div className="form-grid">
            <Field label="Como localizar a marca antiga">
              <select disabled={busy} value={rule.mode} onChange={(event) => patch({ mode: event.target.value as MarkRule['mode'] })}>
                <option value="text">Texto escrito (OCR)</option>
                <option value="image">Referência visual</option>
              </select>
            </Field>
            {rule.mode === 'text' ? (
              <Field label="Texto da marca antiga">
                <input
                  disabled={busy}
                  value={rule.targetText}
                  onChange={(event) => patch({ targetText: event.target.value })}
                  placeholder="Ex.: @pagina_antiga"
                />
              </Field>
            ) : (
              <Field label="Imagem recortada da marca antiga">
                <input
                  disabled={busy}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      patch({ referenceAssetId: await model.store.addReferenceImage(model.profile.id, file) });
                    } catch (error) {
                      setError(String(error));
                    }
                  }}
                />
                {rule.referenceAssetId && <small>Referência salva na conta. Use uma imagem bem recortada em torno da marca.</small>}
              </Field>
            )}
            <Field label="Minha marca em texto">
              <input
                disabled={busy}
                value={rule.replacementText}
                onChange={(event) => patch({ replacementText: event.target.value, replacementTemplateId: undefined })}
              />
            </Field>
            <Field label="Ou minha logo da biblioteca">
              <select
                disabled={busy}
                value={rule.replacementTemplateId || ''}
                onChange={(event) => patch({ replacementTemplateId: event.target.value || undefined })}
              >
                <option value="">Usar texto</option>
                {model.profile.templates
                  .filter((template) => template.category === 'watermark' && template.mediaType !== 'video')
                  .map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Importar minha logo">
              <input
                disabled={busy}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    setError('Escolha uma logo de até 10 MB.');
                    return;
                  }
                  try {
                    patch({
                      replacementTemplateId: await model.store.addTemplate(file, 'watermark', file.name, model.active?.kind || 'video'),
                    });
                  } catch (error) {
                    setError(String(error));
                  }
                }}
              />
            </Field>
            <Field label="Fundo da cobertura">
              <input disabled={busy} type="color" value={rule.color} onChange={(event) => patch({ color: event.target.value })} />
            </Field>
            <Field label="Margem da cobertura">
              <input
                disabled={busy}
                type="range"
                min={0}
                max={0.05}
                step={0.002}
                value={rule.margin}
                onChange={(event) => patch({ margin: Number(event.target.value) })}
              />
            </Field>
            <small>
              A placa de fundo cobre os espaços transparentes da sua logo. Marcas em movimento ou com aparência variável exigem revisão;
              esta análise não é rastreamento contínuo.
            </small>
          </div>
        )}
        <div className="row">
          <Button
            variant="primary"
            disabled={
              busy ||
              !targets.length ||
              (type === 'mark' &&
                (rule.mode === 'text' ? rule.targetText.replace(/[^\p{L}\p{N}]/gu, '').length < 3 : !rule.referenceAssetId))
            }
            onClick={() => void analyze()}
          >
            {busy ? `Analisando ${progress.completed}/${progress.total}…` : 'Analisar seleção'}
          </Button>
          {busy && <Button onClick={() => controller.current?.abort()}>Cancelar análise</Button>}
        </div>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <div className="analysis-results">
          {results.map((result) => (
            <div key={result.id} className="analysis-result">
              <div className="analysis-preview">
                {result.preview && (
                  <img src={result.preview} alt={`Análise de ${model.items.find((item) => item.id === result.id)?.title}`} />
                )}
                {result.rect && (
                  <div
                    className="analysis-box"
                    style={{
                      left: `${result.rect.x * 100}%`,
                      top: `${result.rect.y * 100}%`,
                      width: `${result.rect.width * 100}%`,
                      height: `${result.rect.height * 100}%`,
                    }}
                  />
                )}
              </div>
              <strong>{model.items.find((item) => item.id === result.id)?.title}</strong>
              <small>
                {Math.round(result.confidence * 100)}% de confiança · {result.message}
              </small>
              {result.rect && (
                <Toggle
                  label={`Aplicar em ${model.items.find((item) => item.id === result.id)?.title}`}
                  checked={result.selected}
                  onChange={(selected) =>
                    setResults((values) => values.map((value) => (value.id === result.id ? { ...value, selected } : value)))
                  }
                />
              )}
            </div>
          ))}
        </div>
        {!!results.length && (
          <Button variant="primary" disabled={busy || !results.some((result) => result.selected)} onClick={apply}>
            Aplicar {results.filter((result) => result.selected).length} resultado(s)
          </Button>
        )}
      </div>
    </Modal>
  );
}
