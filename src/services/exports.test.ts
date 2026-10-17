import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMediaItem, createProfile } from '../domain/defaults';
import { canvasBlob, compileStaticPlanes, composeCanvas } from '../render/compositor';
import { nativeCall } from './backend';
import { exportItems } from './exports';
import { getImageExportReport, recordImageExport, resetImageExportReport } from './imageReport';
import { getFfmpegInfo, startExport } from './queue';

vi.mock('./backend', () => ({ isNative: () => true, mediaUrl: (path: string) => path, nativeCall: vi.fn() }));
vi.mock('./queue', () => ({ getFfmpegInfo: vi.fn(), startExport: vi.fn() }));
vi.mock('../render/compositor', () => ({ canvasBlob: vi.fn(), compileStaticPlanes: vi.fn(), composeCanvas: vi.fn() }));

function fixture() {
  const profile = createProfile('Conta');
  profile.exportSettings.outputDir = 'C:\\Exports';
  const image = createMediaItem('image', 1);
  const video = createMediaItem('video', 2);
  for (const item of [image, video]) {
    item.status = 'ready';
    item.sourcePath = `C:\\Inputs\\${item.id}`;
  }
  video.trim.out = 1;
  return { profile, image, video };
}

beforeEach(() => {
  vi.resetAllMocks();
  resetImageExportReport();
  vi.mocked(getFfmpegInfo).mockResolvedValue({
    available: true,
    ffmpegPath: 'ffmpeg',
    ffprobePath: 'ffprobe',
    version: 'test',
    encoders: ['libx264'],
    exiftoolAvailable: false,
    warnings: [],
  });
  vi.mocked(startExport).mockResolvedValue('new-job');
  vi.mocked(compileStaticPlanes).mockResolvedValue([]);
  vi.mocked(composeCanvas).mockResolvedValue({} as HTMLCanvasElement);
  vi.mocked(canvasBlob).mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
  vi.mocked(nativeCall).mockResolvedValue({ path: 'C:\\Exports\\image.png', status: 'ok' });
});

describe('ação após exportar lote misto', () => {
  it.each(['shutdown', 'hibernate'] as const)('bloqueia %s quando uma imagem falha, mantendo o vídeo na fila', async (finishAction) => {
    const { profile, image, video } = fixture();
    vi.mocked(composeCanvas).mockRejectedValueOnce(new Error('Imagem corrompida'));
    expect(await exportItems(profile, [image, video], { finishAction })).toBe('new-job');
    expect(startExport).toHaveBeenCalledWith(
      expect.objectContaining({ finishAction: 'none', items: [expect.objectContaining({ id: video.id })] }),
    );
    expect(getImageExportReport()).toEqual([expect.objectContaining({ id: image.id, status: 'error', error: 'Error: Imagem corrompida' })]);
  });

  it('mantém a ação confirmada quando a imagem é gravada com sucesso', async () => {
    const { profile, image, video } = fixture();
    await exportItems(profile, [image, video], { finishAction: 'shutdown' });
    expect(startExport).toHaveBeenCalledWith(expect.objectContaining({ finishAction: 'shutdown' }));
    expect(getImageExportReport()[0]).toMatchObject({ id: image.id, status: 'ok' });
  });

  it('também bloqueia a ação se a gravação da imagem falha após a renderização', async () => {
    const { profile, image, video } = fixture();
    vi.mocked(nativeCall).mockRejectedValueOnce(new Error('Sem espaço'));
    await exportItems(profile, [image, video], { finishAction: 'hibernate' });
    expect(startExport).toHaveBeenCalledWith(expect.objectContaining({ finishAction: 'none' }));
    expect(getImageExportReport()[0]).toMatchObject({ status: 'error', error: 'Error: Sem espaço' });
  });

  it('descarta o relatório anterior mesmo se o próximo lote falha antes de exportar imagens', async () => {
    const { profile, video } = fixture();
    recordImageExport({ id: 'old', title: 'Antiga', filename: 'old.png', status: 'ok' });
    vi.mocked(getFfmpegInfo).mockRejectedValueOnce(new Error('FFmpeg indisponível'));
    await expect(exportItems(profile, [video])).rejects.toThrow('FFmpeg indisponível');
    expect(getImageExportReport()).toEqual([]);
    expect(startExport).not.toHaveBeenCalled();
  });
});
