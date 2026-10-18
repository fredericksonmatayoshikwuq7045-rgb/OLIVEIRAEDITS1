import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import type { MediaProbe } from '../domain/models';

export const isNative = (): boolean => isTauri();
export const mediaUrl = (path: string): string =>
  isNative() && !/^(blob:|data:|https?:|asset:)/i.test(path) ? convertFileSrc(path) : path;
export const nativeAssetUrl = mediaUrl;

export async function nativeCall<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isNative()) throw new Error('Esta função precisa do aplicativo desktop. Execute npm run tauri dev com FFmpeg e FFprobe instalados.');
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}
export const probeMedia = (path: string): Promise<MediaProbe> => nativeCall('probe_media', { path });

export async function logError(error: unknown): Promise<void> {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  if (isNative()) {
    try {
      await nativeCall('storage_log_error', { message });
    } catch (loggingError) {
      console.error('Não foi possível gravar o diagnóstico.', loggingError);
    }
  }
}
export function installErrorHandlers(): () => void {
  const onError = (event: ErrorEvent) => {
    void logError(event.error ?? event.message);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    void logError(event.reason);
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
