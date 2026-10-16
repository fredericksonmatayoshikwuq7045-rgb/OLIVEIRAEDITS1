import { listen } from '@tauri-apps/api/event';
import { isNative, nativeCall } from './backend';
import type { ExportJob, FfmpegInfo, JobState } from './contracts';

export const getFfmpegInfo = (): Promise<FfmpegInfo> =>
  isNative()
    ? nativeCall('get_ffmpeg_info')
    : Promise.resolve({
        available: false,
        ffmpegPath: null,
        ffprobePath: null,
        version: null,
        encoders: [],
        exiftoolAvailable: false,
        warnings: ['Modo navegador: edição e exportação de imagens. Renderização de vídeo exige o aplicativo desktop.'],
      });
export const getQueueState = (): Promise<JobState[]> => (isNative() ? nativeCall('get_queue_state') : Promise.resolve([]));
export const startExport = (job: ExportJob): Promise<string> => nativeCall('start_export', { job });
export const cancelExport = (jobId: string): Promise<void> => nativeCall('cancel_export', { jobId });
export const cancelAll = (): Promise<void> => nativeCall('cancel_all');
export const pauseExport = (jobId: string, paused: boolean): Promise<void> => nativeCall('pause_export', { jobId, paused });
export const resumeExport = (jobId: string): Promise<void> => nativeCall('resume_export', { jobId });
export async function listenQueue(callback: (jobs: JobState[]) => void): Promise<() => void> {
  if (!isNative()) return () => {};
  let disposed = false;
  const refresh = () => {
    void getQueueState()
      .then((jobs) => {
        if (!disposed) callback(jobs);
      })
      .catch(console.error);
  };
  const unlisteners = await Promise.all(
    ['export://progress', 'export://item-started', 'export://item-finished', 'export://queue-finished'].map((event) =>
      listen(event, refresh),
    ),
  );
  refresh();
  return () => {
    disposed = true;
    unlisteners.forEach((unlisten) => unlisten());
  };
}
