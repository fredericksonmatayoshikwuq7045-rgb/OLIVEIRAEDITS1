import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { unzipSync } from 'fflate';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const target = option('--target') ?? (process.platform === 'win32' ? 'x86_64-pc-windows-msvc' : 'x86_64-unknown-linux-gnu');
if (!['x86_64-pc-windows-msvc', 'x86_64-unknown-linux-gnu'].includes(target))
  throw new Error('Triple não suportado por este helper. Use --target documentado.');
const directory = path.resolve('src-tauri/binaries');
await mkdir(directory, { recursive: true });
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = { target, source: '', verifiedAt: new Date().toISOString(), binaries: {} };
const extension = target.includes('windows') ? '.exe' : '';
const destination = (name) => path.join(directory, `${name}-${target}${extension}`);

if (args.includes('--download-windows')) {
  if (!target.includes('windows')) throw new Error('--download-windows precisa do target Windows.');
  const base = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/';
  const filename = 'ffmpeg-master-latest-win64-gpl.zip';
  const fetchBytes = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download falhou: HTTP ${response.status} em ${url}`);
    return new Uint8Array(await response.arrayBuffer());
  };
  const checksums = new TextDecoder().decode(await fetchBytes(`${base}checksums.sha256`));
  const checksum = checksums
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .find((fields) => fields.at(-1)?.replace(/^\*/, '') === filename)?.[0];
  if (!checksum || !/^[0-9a-f]{64}$/i.test(checksum)) throw new Error('O manifesto oficial não contém SHA-256 para o arquivo escolhido.');
  const temporary = await mkdtemp(path.join(tmpdir(), 'oliveira-sidecars-'));
  let archive;
  try {
    const targetFile = path.join(temporary, filename);
    // curl resumes interrupted large transfers; TLS and publisher SHA-256 remain mandatory.
    execFileSync(
      process.platform === 'win32' ? 'curl.exe' : 'curl',
      [
        '--fail',
        '--location',
        '--silent',
        '--show-error',
        '--retry',
        '3',
        '--retry-all-errors',
        '--continue-at',
        '-',
        '--output',
        targetFile,
        `${base}${filename}`,
      ],
      { stdio: 'inherit' },
    );
    archive = new Uint8Array(await readFile(targetFile));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  if (digest(archive) !== checksum.toLowerCase())
    throw new Error('SHA-256 divergente. Nenhum executável será instalado. Tente novamente com um release consistente.');
  const files = unzipSync(archive, { filter: (entry) => /\/bin\/(?:ffmpeg|ffprobe)\.exe$/.test(entry.name) });
  for (const name of ['ffmpeg', 'ffprobe']) {
    const entry = Object.entries(files).find(([filename]) => filename.endsWith(`/bin/${name}.exe`));
    if (!entry) throw new Error(`${name}.exe ausente no arquivo verificado.`);
    await writeFile(destination(name), entry[1]);
    manifest.binaries[name] = digest(entry[1]);
  }
  manifest.source = `${base}${filename} (SHA-256 ${checksum})`;
} else {
  const from = option('--from');
  for (const name of ['ffmpeg', 'ffprobe']) {
    const source = from
      ? path.resolve(from, `${name}${extension}`)
      : execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', [name], { encoding: 'utf8' })
          .trim()
          .split(/\r?\n/)[0];
    if (target.includes('windows') && !from) throw new Error('Para Windows use --download-windows ou --from com executáveis confiáveis.');
    const bytes = await readFile(source);
    await copyFile(source, destination(name));
    if (digest(await readFile(destination(name))) !== digest(bytes)) throw new Error('Falha ao verificar a cópia do sidecar.');
    await chmod(destination(name), 0o755);
    manifest.binaries[name] = digest(bytes);
  }
  manifest.source = from
    ? `Diretório fornecido: ${path.resolve(from)}`
    : 'Executáveis instalados no sistema; somente para desenvolvimento nesta plataforma.';
}
await writeFile(path.join(directory, `manifest-${target}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`FFmpeg e FFprobe preparados para ${target}. SHA-256 registrado no manifesto local.`);
