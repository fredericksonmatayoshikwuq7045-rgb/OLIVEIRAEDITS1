import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.OE_TEST_URL || 'http://127.0.0.1:3000';
const directory = process.env.OE_EXPORT_TEST_DIR || '.artifacts/export-regressions';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
const results = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', (dialog) => dialog.accept());

// The hook, report and image renderer are real; only the desktop IPC boundary is simulated.
await page.route('**/src/main.tsx*', (route) =>
  route.fulfill({
    contentType: 'text/javascript',
    body: String.raw`
    import React from '/node_modules/.vite/deps/react.js';
    import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
    import { createProfile, createMediaItem } from '/src/domain/defaults.ts';
    import { useExportDialog } from '/src/ui/useExportDialog.ts';
    import { QueueReport } from '/src/ui/QueueReport.tsx';
    const { useState } = React;
    const { createRoot } = ReactDOM;
    const profile = createProfile('Atual');
    profile.exportSettings.outputDir = 'C:\\Novo destino';
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 4;
    canvas.getContext('2d').fillRect(0, 0, 4, 4);
    const good = createMediaItem('image', 1);
    const bad = createMediaItem('image', 2);
    const video = createMediaItem('video', 3);
    for (const item of [good, bad, video]) {
      item.status = 'ready';
      item.sourcePath = 'C:\\Input\\' + item.id;
      item.render.canvas.width = item.render.canvas.height = 16;
    }
    good.title = 'Boa.png';
    good.runtimeUrl = canvas.toDataURL();
    bad.title = 'Corrompida.png';
    bad.runtimeUrl = 'data:image/png;base64,bm90LWFuLWltYWdl';
    video.trim.out = 1;
    const health = { available: true, warnings: [], encoders: ['libx264'], exiftoolAvailable: false };
    const oldItems = [{ id: 'failed', outputPath: 'C:\\Destino antigo\\erro.mp4' }, { id: 'ok', outputPath: 'D:\\Outro destino\\ok.mp4' }];
    const stateItem = (item, status) => ({
      ...item, sourcePath: 'C:\\Input\\video.mp4', status, error: status === 'error' ? 'Falha antiga' : null,
      logPath: null, durationMs: null, outputSize: null, metadata: null,
      progress: { percent: 0, fps: null, speed: null, outSizeBytes: null, etaSeconds: null },
    });
    window.__jobs = [{ id: 'old-job', status: 'completed', warnings: [], items: oldItems.map((item, i) => stateItem(item, i ? 'ok' : 'error')), request: { items: oldItems, concurrency: 1, finishAction: 'shutdown' } }];
    window.__requests = [];
    window.__opened = [];
    window.isTauri = true;
    window.__TAURI_INTERNALS__ = {
      convertFileSrc: (path) => path,
      invoke: async (command, args) => {
        if (command === 'get_ffmpeg_info') return health;
        if (command === 'storage_export_image') return { status: 'ok', path: args.outputDir + '/' + args.filename };
        if (command === 'open_authorized_path') { window.__opened.push(args.path); return; }
        if (command === 'start_export') {
          window.__requests.push(args.job);
          const id = 'new-job-' + window.__requests.length;
          window.__jobs.push({ id, status: 'pending', warnings: [], request: args.job, items: args.job.items.map((item) => stateItem(item, 'pending')) });
          return id;
        }
        throw new Error('Unexpected IPC: ' + command);
      },
    };
    function Harness() {
      const [jobs, setJobs] = useState(window.__jobs.slice());
      const [messages, setMessages] = useState([]);
      const engine = { info: health, jobs, error: '', refresh: async () => setJobs(window.__jobs.slice()) };
      const model = useExportDialog({ profile, items: [good, bad, video], engine, settings: { concurrency: 1 }, onProfile() {}, onClose() {}, notify: (message) => setMessages((previous) => [...previous, message]) });
      return React.createElement('main', {},
        React.createElement('button', { onClick: () => model.setFinishAction('shutdown') }, 'Escolher desligamento'),
        React.createElement('button', { onClick: () => model.run() }, 'Exportar lote misto'),
        React.createElement('output', { id: 'current-job' }, model.jobId),
        React.createElement('p', { role: 'status' }, messages.join('\n')),
        React.createElement('p', { id: 'error' }, model.error),
        React.createElement(QueueReport, { model }),
      );
    }
    createRoot(document.getElementById('root')).render(React.createElement(Harness));
  `,
  }),
);

try {
  await page.goto(url);
  await page.getByText('1 concluídos', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Abrir pasta de saída · C:\\Destino antigo' }).click();
  await page.getByRole('button', { name: 'Abrir pasta de saída · D:\\Outro destino' }).click();
  assert.deepEqual(await page.evaluate(() => window.__opened), ['C:\\Destino antigo', 'D:\\Outro destino']);
  results.push('Abrir pasta usa cada destino histórico, mesmo com a conta apontando para outra pasta');

  await page.getByRole('button', { name: 'Repetir falhas' }).click();
  await page.locator('#current-job').filter({ hasText: 'new-job-1' }).waitFor();
  await page.getByText('0 concluídos', { exact: true }).waitFor();
  assert.equal(await page.getByText('Falha antiga', { exact: true }).count(), 0);
  const retry = await page.evaluate(() => window.__requests[0]);
  assert.deepEqual(
    retry.items.map((item) => item.id),
    ['failed'],
  );
  assert.equal(retry.finishAction, 'none');
  results.push('Repetir falhas mostra o novo lote e envia somente os arquivos com erro');

  await page.getByRole('button', { name: 'Escolher desligamento' }).click();
  await page.getByRole('button', { name: 'Exportar lote misto' }).click();
  await page.locator('#current-job').filter({ hasText: 'new-job-2' }).waitFor();
  await page.getByText('1 concluídos', { exact: true }).waitFor();
  await page.getByText('1 falhas', { exact: true }).waitFor();
  await page.getByRole('status').filter({ hasText: 'foi desativada porque uma imagem falhou' }).waitFor();
  assert.equal(await page.evaluate(() => window.__requests[1].finishAction), 'none');
  assert.equal(await page.locator('#error').textContent(), '');
  results.push('Canvas real: imagem válida e imagem corrompida aparecem no resumo, bloqueiam desligamento e avisam o usuário');
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/report.json`,
    JSON.stringify({ passed: true, boundary: 'Chromium real; IPC desktop simulado', checks: results }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, checks: results }, null, 2));
} catch (error) {
  await writeFile(`${directory}/failure.txt`, `${error}\n${errors.join('\n')}\n${await page.locator('body').innerText()}`);
  throw error;
} finally {
  await browser.close();
}
