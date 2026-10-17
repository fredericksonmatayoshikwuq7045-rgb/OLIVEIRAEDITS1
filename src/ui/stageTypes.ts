import type { MediaItem } from '../domain/models';
export interface Drag {
  x: number;
  y: number;
  item: MediaItem;
  handle?: string;
  layerId?: string;
}
export type StageProps = {
  item: MediaItem | null;
  onChange: (item: MediaItem) => void;
  playing: boolean;
  time: number;
  onTime: (time: number) => void;
  onEnded: () => void;
  cropMode: boolean;
  cropLocked: boolean;
  guides: boolean;
  safeZone: boolean;
  activeLayerId: string | null;
  onImport: () => void;
  onImportFolder: () => void;
  importing: boolean;
  resolveSource: (source: string) => string;
  notify: (message: string) => void;
  onDropFiles: (files: File[]) => void;
};
