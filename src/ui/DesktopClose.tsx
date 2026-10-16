import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isNative, nativeCall } from '../services/native';
import type { WorkspaceStore } from './Dashboard';
import { Button, Modal } from './Primitives';
import type { EngineState } from './useEngine';
export function DesktopClose({ store, engine }: { store: WorkspaceStore; engine: EngineState }) {
  const [confirming, setConfirming] = useState(false),
    [error, setError] = useState(''),
    [closing, setClosing] = useState(false);
  const state = useRef({ store, engine });
  state.current = { store, engine };
  const pending = useRef(false),
    closingRef = useRef(false);
  const close = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    try {
      await state.current.store.flush();
      await nativeCall('confirm_close');
    } catch (reason) {
      setError(`Não foi possível salvar antes de fechar: ${String(reason)}`);
      setClosing(false);
      closingRef.current = false;
      setConfirming(true);
    }
  }, []);
  useEffect(() => {
    if (!isNative()) return;
    let disposed = false;
    const stops: (() => void)[] = [];
    const requestClose = () => {
      if (pending.current) return;
      pending.current = true;
      const active = state.current.engine.jobs.some((job) => ['pending', 'running', 'paused'].includes(job.status));
      if (active) setConfirming(true);
      else void close();
    };
    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const handlers = await Promise.all([
        getCurrentWindow().onCloseRequested((event) => {
          event.preventDefault();
          requestClose();
        }),
        listen('export://close-requested', () => {
          if (!pending.current) {
            pending.current = true;
            setConfirming(true);
          }
        }),
      ]);
      if (disposed) handlers.forEach((stop) => stop());
      else stops.push(...handlers);
    });
    return () => {
      disposed = true;
      stops.forEach((stop) => stop());
    };
  }, [close]);
  if (!confirming) return null;
  const keepOpen = () => {
    pending.current = false;
    setConfirming(false);
    setError('');
  };
  return (
    <Modal title="Fechar o aplicativo?" onClose={keepOpen}>
      <div className="stack">
        <p>
          Há arquivos na fila de exportação. Ao sair, os processos FFmpeg serão cancelados e o estado da fila será preservado para retomada.
        </p>
        <p className="muted">Seu projeto será salvo antes do encerramento.</p>
        {error && <p className="error-message">{error}</p>}
        <div className="form-actions">
          <Button onClick={keepOpen}>Continuar trabalhando</Button>
          <Button variant="danger" disabled={closing} onClick={() => void close()}>
            {closing ? 'Salvando…' : 'Salvar, cancelar fila e sair'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
