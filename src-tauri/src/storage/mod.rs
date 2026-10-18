mod atomic;
mod paths;
#[cfg(target_os="linux")]
pub mod media_server;
pub mod grants;
pub mod images;
#[cfg(feature = "desktop")]
pub mod commands;
#[cfg(test)]
mod tests;

use std::{fs, io::{Read, Write}, path::{Path, PathBuf}, sync::Mutex};
use atomic::{backup_path, write_atomic};
pub use paths::canonical_target;
pub use atomic::{atomic_replace, write_atomic as atomic_write};

pub const MAX_JSON_BYTES: u64 = 32 * 1024 * 1024;
pub const MAX_ASSET_BYTES: u64 = 256 * 1024 * 1024;
static IO_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug)]
pub struct Storage {
    pub data_dir: PathBuf,
    pub cache_dir: PathBuf,
}

impl Storage {
    pub fn new(data_dir: PathBuf, cache_dir: PathBuf) -> Result<Self, String> {
        for dir in [&data_dir, &cache_dir] {
            fs::create_dir_all(dir).map_err(|e| format!("Não foi possível criar a pasta do aplicativo: {e}"))?;
        }
        Ok(Self { data_dir: data_dir.canonicalize().map_err(|e| e.to_string())?,
            cache_dir: cache_dir.canonicalize().map_err(|e| e.to_string())? })
    }

    pub fn resolve(&self, relative: &str) -> Result<PathBuf, String> {
        paths::relative_path(&self.data_dir, relative)
    }

    pub fn read_json(&self, relative: &str) -> Result<Option<String>, String> {
        let path = self.json_path(relative)?;
        let _lock = IO_LOCK.lock().map_err(|_| "O armazenamento está temporariamente indisponível.")?;
        let mut primary_error = None;
        for candidate in [&path, &backup_path(&path, ".bak"), &backup_path(&path, ".bak.1")] {
            paths::reject_symlink_ancestors(&self.data_dir, candidate)?;
            match read_bounded(candidate, MAX_JSON_BYTES).and_then(|bytes| {
                let text = String::from_utf8(bytes).map_err(|_| "O JSON não é UTF-8 válido.".to_string())?;
                serde_json::from_str::<serde_json::Value>(&text).map_err(|e| format!("JSON inválido: {e}"))?;
                Ok(text)
            }) {
                Ok(text) => {
                    if candidate != &path { log::warn!("Estado recuperado de backup: {}", candidate.display()); }
                    return Ok(Some(text));
                }
                Err(error) if candidate.exists() => { if primary_error.is_none() { primary_error = Some(error); } }
                Err(_) => {}
            }
        }
        match primary_error { Some(error) => Err(format!("Dados e backups não puderam ser lidos: {error}")), None => Ok(None) }
    }

    pub fn write_json(&self, relative: &str, contents: &str) -> Result<(), String> {
        if contents.len() as u64 > MAX_JSON_BYTES { return Err("O projeto excede o limite de 32 MiB.".into()); }
        serde_json::from_str::<serde_json::Value>(contents).map_err(|e| format!("JSON inválido; nada foi alterado: {e}"))?;
        let path = self.json_path(relative)?;
        let _lock = IO_LOCK.lock().map_err(|_| "O armazenamento está temporariamente indisponível.")?;
        for suffix in [".bak", ".bak.1"] {
            paths::reject_symlink_ancestors(&self.data_dir, &backup_path(&path, suffix))?;
        }
        write_atomic(&path, contents.as_bytes(), true)
    }

    fn json_path(&self, relative: &str) -> Result<PathBuf, String> {
        let path = self.resolve(relative)?;
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            return Err("O arquivo de estado precisa ter extensão .json.".into());
        }
        Ok(path)
    }

    pub fn write_asset(&self, relative: &str, bytes: &[u8]) -> Result<PathBuf, String> {
        if bytes.len() as u64 > MAX_ASSET_BYTES { return Err("O asset excede o limite de 256 MiB.".into()); }
        let path = self.resolve(relative)?;
        if !relative.starts_with("profiles/") || !relative.contains("/assets/") {
            return Err("Assets devem ser salvos em profiles/<id>/assets/.".into());
        }
        validate_asset_extension(&path)?;
        let _lock = IO_LOCK.lock().map_err(|_| "O armazenamento está temporariamente indisponível.")?;
        write_atomic(&path, bytes, false)?;
        Ok(path)
    }

    pub fn read_asset(&self, relative: &str) -> Result<Vec<u8>, String> {
        let path = self.resolve(relative)?;
        validate_asset_extension(&path)?;
        read_bounded(&path, MAX_ASSET_BYTES)
    }

    pub fn import_asset(&self, source: &Path, relative: &str) -> Result<PathBuf, String> {
        validate_asset_extension(source)?;
        let bytes = read_bounded(source, MAX_ASSET_BYTES)?;
        self.write_asset(relative, &bytes)
    }

    pub fn log_error(&self, message: &str) -> Result<(), String> {
        let _lock = IO_LOCK.lock().map_err(|_| "O log está temporariamente indisponível.")?;
        let logs = self.data_dir.join("logs");
        paths::reject_symlink_ancestors(&self.data_dir, &logs)?;
        fs::create_dir_all(&logs).map_err(|e| e.to_string())?;
        let path = logs.join("frontend.log");
        paths::reject_symlink_ancestors(&self.data_dir, &path)?;
        if fs::metadata(&path).map(|m| m.len() > 2 * 1024 * 1024).unwrap_or(false) {
            write_atomic(&path, b"", true)?;
        }
        let time = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
        let message: String = message.chars().take(16000).filter(|c| *c == '\n' || *c == '\t' || !c.is_control()).collect();
        let mut file = fs::OpenOptions::new().create(true).append(true).open(path).map_err(|e| e.to_string())?;
        writeln!(file, "[{time}] {message}").map_err(|e| e.to_string())
    }
}

pub fn read_bounded(path: &Path, max: u64) -> Result<Vec<u8>, String> {
    let file = fs::File::open(path).map_err(|e| format!("Não foi possível abrir {}: {e}", path.display()))?;
    let metadata = file.metadata().map_err(|e| e.to_string())?;
    if !metadata.is_file() { return Err("O caminho não é um arquivo regular.".into()); }
    if metadata.len() > max { return Err("O arquivo excede o limite de tamanho permitido.".into()); }
    let mut bytes = Vec::new();
    file.take(max + 1).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if bytes.len() as u64 > max { return Err("O arquivo excede o limite de tamanho permitido.".into()); }
    Ok(bytes)
}

fn validate_asset_extension(path: &Path) -> Result<(), String> {
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    if matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" | "tif" | "tiff" | "avif" | "svg"
        | "mp4" | "m4v" | "mov" | "mkv" | "avi" | "webm" | "wmv" | "mpeg" | "mpg" | "mts" | "m2ts"
        | "ttf" | "otf" | "woff" | "woff2") { Ok(()) }
    else { Err("Formato de asset não suportado. Use imagem, vídeo ou fonte.".into()) }
}
