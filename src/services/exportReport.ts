import type { JobState } from './contracts';
import type { ImageExportResult } from './imageReport';

export function exportTotals(jobs: JobState[], images: ImageExportResult[]) {
  const statuses = [...jobs.flatMap((job) => job.items.map((item) => item.status)), ...images.map((image) => image.status)];
  return {
    completed: statuses.filter((status) => status === 'ok' || status === 'download').length,
    failed: statuses.filter((status) => status === 'error').length,
    skipped: statuses.filter((status) => status === 'skipped').length,
  };
}

export function jobOutputDirectories(job: JobState): string[] {
  return [
    ...new Set(
      job.items.flatMap(({ outputPath }) => {
        const separator = Math.max(outputPath.lastIndexOf('/'), outputPath.lastIndexOf('\\'));
        if (separator < 0) return [];
        const directory = outputPath.slice(0, separator);
        return [separator === 0 || /^[a-z]:$/i.test(directory) ? outputPath.slice(0, separator + 1) : directory];
      }),
    ),
  ];
}
