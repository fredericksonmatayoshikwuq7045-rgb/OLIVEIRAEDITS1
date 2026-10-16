import { invoke, isTauri } from '@tauri-apps/api/core';
import { browserRead, browserWrite } from './browserStore';

export const isNative = (): boolean => isTauri();
export async function readJson<T>(relativePath: string): Promise<T | null> {
  const json = isNative()
    ? await invoke<string | null>('storage_read_json', { relativePath })
    : await browserRead<string>('records', relativePath);
  if (json === null) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    throw new Error(`Arquivo de dados inválido: ${relativePath}. Preserve o arquivo e restaure seu backup.`);
  }
}
export async function writeJson(relativePath: string, value: unknown): Promise<void> {
  const contents = JSON.stringify(value);
  if (isNative()) await invoke('storage_write_json', { relativePath, contents });
  else {
    const previous = await browserRead<string>('records', relativePath);
    if (previous !== null) await browserWrite('records', `${relativePath}.bak`, previous);
    await browserWrite('records', relativePath, contents);
  }
}
export async function writeBytes(relativePath: string, bytes: Uint8Array): Promise<string> {
  if (isNative()) return invoke<string>('storage_write_asset', { relativePath, bytes: [...bytes] });
  await browserWrite('assets', relativePath, bytes);
  return relativePath;
}
export async function readBytes(relativePath: string): Promise<Uint8Array> {
  if (isNative()) return new Uint8Array(await invoke<number[]>('storage_read_asset', { relativePath }));
  const result = await browserRead<Uint8Array>('assets', relativePath);
  if (!result) throw new Error(`Arquivo de asset ausente: ${relativePath}. Importe o backup do perfil.`);
  return result;
}
export async function importAsset(sourcePath: string, relativePath: string): Promise<string> {
  return invoke<string>('storage_import_asset', { sourcePath, relativePath });
}
export async function pathExists(path: string): Promise<boolean> {
  return isNative() ? invoke<boolean>('storage_exists', { path }) : false;
}
export async function authorizePaths(paths: string[]): Promise<void> {
  if (isNative()) await invoke('storage_authorize_paths', { paths });
}
