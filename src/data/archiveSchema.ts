/** Validate backup data before it can enter the workspace or write assets. */
export type Check = (value: unknown, path: string) => void;
export function invalid(path: string): never {
  throw new Error(
    `Backup inválido em ${path}. Nenhuma conta foi importada; gere novamente o .oeprofile na versão 2 ou restaure um backup íntegro.`,
  );
}
export function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path);
  return value as Record<string, unknown>;
}
export const text: Check = (value, path) => {
  if (typeof value !== 'string') invalid(path);
};
export const identifier: Check = (value, path) => {
  if (typeof value !== 'string' || !value.length || value.length > 128 || [...value].some((character) => character.charCodeAt(0) < 32))
    invalid(path);
};
export const number: Check = (value, path) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path);
};
export const boolean: Check = (value, path) => {
  if (typeof value !== 'boolean') invalid(path);
};
export const positive: Check = (value, path) => {
  number(value, path);
  if ((value as number) <= 0) invalid(path);
};
export const opacity: Check = (value, path) => {
  number(value, path);
  if ((value as number) < 0 || (value as number) > 1) invalid(path);
};
export const choices =
  (...values: unknown[]): Check =>
  (value, path) => {
    if (!values.includes(value)) invalid(path);
  };
export const optional =
  (check: Check): Check =>
  (value, path) => {
    if (value !== undefined) check(value, path);
  };
export const nullable =
  (check: Check): Check =>
  (value, path) => {
    if (value !== null) check(value, path);
  };
export const fields =
  (checks: Record<string, Check>): Check =>
  (value, path) => {
    const source = record(value, path);
    for (const [key, check] of Object.entries(checks)) check(source[key], `${path}.${key}`);
  };
export const list =
  (check: Check, minimum = 0): Check =>
  (value, path) => {
    if (!Array.isArray(value) || value.length < minimum || value.length > 10000) invalid(path);
    value.forEach((entry, index) => check(entry, `${path}[${index}]`));
  };
export const kind = choices('image', 'video');
export const aspect = choices('9:16', '16:9', '1:1', '4:5');
export const rect = fields({ x: number, y: number, width: positive, height: positive });
