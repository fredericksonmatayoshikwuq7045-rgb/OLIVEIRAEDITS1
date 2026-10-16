export interface ImageExportResult {
  id: string;
  title: string;
  filename: string;
  status: 'ok' | 'download' | 'skipped' | 'error';
  bytes?: number;
  path?: string | null;
  error?: string;
}
let results: ImageExportResult[] = [];
export const getImageExportReport = (): ImageExportResult[] => results.map((result) => ({ ...result }));
export const resetImageExportReport = (): void => {
  results = [];
};
export const recordImageExport = (result: ImageExportResult): void => {
  results.push(result);
};
