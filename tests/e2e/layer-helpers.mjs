import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
export function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-nostdin', '-y', '-v', 'error', ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
export async function fixtures(page, directory) {
  const video = `${directory}/clip.mp4`,
    stamp = `${directory}/stamp.mp4`,
    photo = `${directory}/photo.png`,
    border = `${directory}/border.png`,
    headline = `${directory}/headline.png`;
  ffmpeg([
    '-f',
    'lavfi',
    '-i',
    'color=c=0x303030:s=320x180:r=20',
    '-t',
    '6',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-threads',
    '1',
    video,
  ]);
  ffmpeg([
    '-f',
    'lavfi',
    '-i',
    'color=c=red:s=64x64:r=20',
    '-vf',
    "drawbox=c=blue:t=fill:enable='gte(t,0.5)',drawbox=c=lime:t=fill:enable='gte(t,1.5)'",
    '-t',
    '3',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-threads',
    '1',
    stamp,
  ]);
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const x = canvas.getContext('2d');
    x.fillStyle = '#303030';
    x.fillRect(0, 0, 160, 90);
    const photo = canvas.toDataURL().split(',')[1];
    x.clearRect(0, 0, 160, 90);
    x.strokeStyle = 'cyan';
    x.lineWidth = 3;
    x.strokeRect(0, 0, 160, 90);
    const border = canvas.toDataURL().split(',')[1];
    x.clearRect(0, 0, 160, 90);
    return { photo, border, headline: canvas.toDataURL().split(',')[1] };
  });
  await Promise.all(
    [
      [photo, data.photo],
      [border, data.border],
      [headline, data.headline],
    ].map(([file, bytes]) => writeFile(file, Buffer.from(bytes, 'base64'))),
  );
  return { video, stamp, photo, border, headline };
}
export async function choose(page, action, files) {
  const pending = page.waitForEvent('filechooser');
  await action();
  await (await pending).setFiles(files);
}
export async function saved(page) {
  await page.waitForFunction(() => document.querySelector('.save-status')?.textContent === 'Salvo');
}
export async function stored(page) {
  await saved(page);
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('OliveiraEditsV2');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            q = db.transaction('records').objectStore('records').get('workspace.json');
          q.onsuccess = () => {
            db.close();
            resolve(JSON.parse(q.result));
          };
        };
      }),
  );
}
export async function currentItem(page, title) {
  const data = await stored(page);
  return data.projects
    .find((project) => project.id === data.activeProjectByProfile[data.activeProfileId])
    .items.find((item) => item.title === title);
}
export async function number(page, label, value) {
  const input = page.getByRole('spinbutton', { name: label, exact: true });
  await input.fill(String(value));
  await input.press('Enter');
}
export async function range(page, label, value) {
  await page.getByRole('slider', { name: label, exact: true }).evaluate((node, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, String(value));
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
export const track = (page, id) => page.locator('.timeline-track-row').filter({ has: page.locator(`[data-track-id="${id}"]`) });
export async function selectTrack(page, id) {
  await page.locator(`.timeline-track-row[data-track-id="${id}"] .timeline-track-name`).click();
}
export async function color(page, x, y, channel) {
  await page.waitForFunction(
    ({ x, y, channel }) => {
      const canvas = document.querySelector('.stage-preview canvas');
      if (!canvas || canvas.getAttribute('aria-busy') === 'true') return false;
      const pixel = canvas.getContext('2d').getImageData(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1).data;
      return channel === -1
        ? Math.max(...pixel.slice(0, 3)) < 80
        : pixel[channel] > 170 && pixel[(channel + 1) % 3] < 100 && pixel[(channel + 2) % 3] < 100;
    },
    { x, y, channel },
    { timeout: 15000 },
  );
}
export async function exportPng(page, name) {
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar 1 mídias', exact: true }).click();
  const download = await pending;
  assert.equal(await download.failure(), null);
  await download.saveAs(name);
  await page.getByRole('dialog', { name: 'Exportar projeto', exact: true }).getByRole('button', { name: 'Fechar', exact: true }).click();
}
export async function pngPixel(page, fileBytes, x, y, channel) {
  const values = await page.evaluate(
    async ({ data, x, y }) => {
      const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob()),
        canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      return [...ctx.getImageData(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1).data];
    },
    { data: fileBytes.toString('base64'), x, y },
  );
  if (channel === -1) assert.ok(Math.max(...values.slice(0, 3)) < 80, values.toString());
  else assert.ok(values[channel] > 170 && values[(channel + 1) % 3] < 100 && values[(channel + 2) % 3] < 100, values.toString());
}
