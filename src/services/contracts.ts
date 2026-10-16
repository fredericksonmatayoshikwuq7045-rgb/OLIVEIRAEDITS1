import type { MediaProbe, Profile } from '../domain/models';
import type { RenderGeometry, RenderImageLayer, RenderSpec } from '../render/types';

export interface FfmpegInfo {
  available: boolean;
  ffmpegPath: string | null;
  ffprobePath: string | null;
  version: string | null;
  encoders: string[];
  exiftoolAvailable: boolean;
  warnings: string[];
}
export type EngineRenderSpec = Omit<RenderSpec, 'layers'> & {
  geometry: RenderGeometry;
  layers: RenderImageLayer[];
};
export interface ExportItem {
  id: string;
  sourcePath: string;
  outputPath: string;
  trim?: { start: number; duration: number };
  render?: EngineRenderSpec;
  overlays: { path: string; zIndex: number; enable?: { start: number; end: number } }[];
  preset: Profile['exportSettings']['preset'];
  encoder?: Profile['exportSettings']['encoder'];
  cleanMetadata: boolean;
  conflict: Profile['exportSettings']['conflict'];
  mode: 'render' | 'metadata';
  deepClean?: boolean;
  moveOriginal?: boolean;
  speed: number;
  fps?: number;
  silentAudio?: boolean;
}
export type FinishAction = 'none' | 'shutdown' | 'hibernate';
export interface ExportJob {
  items: ExportItem[];
  concurrency: number;
  finishAction?: FinishAction;
}
export interface ExportProgress {
  jobId: string;
  itemId: string;
  percent: number;
  fps: number | null;
  speed: number | null;
  outSizeBytes: number | null;
  etaSeconds: number | null;
}
export interface MetadataReport {
  before: Record<string, string>;
  after: Record<string, string>;
  removed: string[];
  sensitiveRemaining: string[];
  exiftoolUsed: boolean;
}
export interface ItemState {
  id: string;
  sourcePath: string;
  outputPath: string;
  status: 'pending' | 'processing' | 'ok' | 'error' | 'cancelled' | 'skipped';
  progress: ExportProgress;
  error: string | null;
  logPath: string | null;
  durationMs: number | null;
  outputSize: number | null;
  metadata: MetadataReport | null;
}
export interface JobState {
  id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled';
  concurrency: number;
  items: ItemState[];
  warnings: string[];
  request: ExportJob;
}
export type QueueState = JobState;
export type ProbeInfo = MediaProbe;
export interface ExportOptions {
  concurrency?: number;
  fps?: number;
  silentAudio?: boolean;
  finishAction?: FinishAction;
}
