import { describe, expect, it } from 'vitest';
import type { JobState } from './contracts';
import { exportTotals, jobOutputDirectories } from './exportReport';
import type { ImageExportResult } from './imageReport';

const jobWithPaths = (...paths: string[]) => ({ items: paths.map((outputPath) => ({ outputPath })) }) as JobState;

describe('relatório de lotes mistos', () => {
  it('inclui imagens gravadas, downloads, falhas e itens pulados nos totais', () => {
    const jobs = [{ items: [{ status: 'ok' }, { status: 'error' }, { status: 'pending' }] }] as JobState[];
    const images = ['ok', 'download', 'error', 'skipped'].map((status) => ({ status })) as ImageExportResult[];
    expect(exportTotals(jobs, images)).toEqual({ completed: 3, failed: 2, skipped: 1 });
    expect(exportTotals([], images)).toEqual({ completed: 2, failed: 1, skipped: 1 });
  });

  it.each([
    ['/exports/arquivo.mp4', '/exports'],
    ['/arquivo.mp4', '/'],
    ['C:\\Exports\\arquivo.mp4', 'C:\\Exports'],
    ['C:\\arquivo.mp4', 'C:\\'],
    ['C:/arquivo.mp4', 'C:/'],
    ['C:\\Exports/arquivo.mp4', 'C:\\Exports'],
    ['\\\\servidor\\pasta\\arquivo.mp4', '\\\\servidor\\pasta'],
  ])('usa a pasta histórica de %s', (path, expected) => {
    expect(jobOutputDirectories(jobWithPaths(path))).toEqual([expected]);
  });

  it('mostra cada destino do lote uma vez, sem inventar destino para caminhos sem pasta', () => {
    expect(jobOutputDirectories(jobWithPaths('/old/a.mp4', '/old/b.mp4', '/other/c.mp4', 'file.mp4'))).toEqual(['/old', '/other']);
  });
});
