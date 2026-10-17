import { isNative, nativeCall } from './backend';
import { mediaExtensions as extensions, mediaKind } from '../domain/mediaFormats';

let mediaPickerOpen = false;
async function pickMedia(select: () => Promise<string[] | File[]>): Promise<string[] | File[]> {
  if (mediaPickerOpen) return [];
  mediaPickerOpen = true;
  try {
    return await select();
  } finally {
    mediaPickerOpen = false;
  }
}
function browserFiles(folder: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,video/*';
    if (folder) input.setAttribute('webkitdirectory', '');
    input.hidden = true;
    const finish = (files: File[]) => {
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])), { once: true });
    input.addEventListener('cancel', () => finish([]), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}
async function authorize(paths: string[]): Promise<string[]> {
  if (paths.length) await nativeCall('storage_authorize_paths', { paths });
  return paths;
}
export async function chooseMediaFiles(): Promise<string[] | File[]> {
  return pickMedia(async () => {
    if (!isNative()) return browserFiles(false);
    const { open } = await import('@tauri-apps/plugin-dialog');
    const result = await open({ multiple: true, title: 'Importar vídeos e imagens', filters: [{ name: 'Mídias', extensions }] });
    return authorize(result ? (Array.isArray(result) ? result : [result]) : []);
  });
}
export async function chooseMediaFolder(): Promise<string[] | File[]> {
  return pickMedia(async () => {
    if (!isNative()) return browserFiles(true);
    const { open } = await import('@tauri-apps/plugin-dialog');
    const path = await open({ directory: true, title: 'Importar pasta de mídias' });
    if (!path || Array.isArray(path)) return [];
    await authorize([path]);
    const { readDir } = await import('@tauri-apps/plugin-fs');
    const entries = await readDir(path);
    return entries
      .filter((entry) => entry.isFile && mediaKind(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR', { numeric: true }))
      .map((entry) => `${path.replace(/[\\/]$/, '')}/${entry.name}`);
  });
}
export async function chooseOutputDirectory(initial?: string): Promise<string | null> {
  if (!isNative()) throw new Error('No navegador, imagens são salvas por download. Escolha de pasta exige o aplicativo desktop.');
  const { open } = await import('@tauri-apps/plugin-dialog');
  const result = await open({ directory: true, title: 'Pasta de saída', defaultPath: initial || undefined });
  if (!result || Array.isArray(result)) return null;
  await authorize([result]);
  return result;
}
export async function openPath(path: string): Promise<void> {
  await nativeCall('open_authorized_path', { path });
}
export async function openLogs(): Promise<void> {
  const paths = await nativeCall<{ logDir: string; appLogDir: string }>('storage_get_paths');
  await openPath(paths.appLogDir);
}
export async function notifyCompleted(title: string, body: string): Promise<void> {
  if (!isNative()) return;
  const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
  if ((await isPermissionGranted()) || (await requestPermission()) === 'granted') sendNotification({ title, body });
}
