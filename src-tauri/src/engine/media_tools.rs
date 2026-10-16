use std::{collections::hash_map::DefaultHasher, fs, hash::{Hash, Hasher}, path::Path, process::Command};
use super::probe;

pub fn thumbnail(source: &str, cache: &Path) -> Result<String, String> {
    let input = probe::input_path(source)?;
    let metadata = fs::metadata(&input).map_err(|error| error.to_string())?;
    let mut key = DefaultHasher::new();
    input.hash(&mut key); metadata.len().hash(&mut key); metadata.modified().ok().hash(&mut key);
    let directory = cache.join("thumbnails");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let output = directory.join(format!("{:x}.png", key.finish()));
    if output.is_file() { return Ok(output.to_string_lossy().into_owned()); }
    let info = probe::probe(source)?;
    let time = if info.is_image { 0.0 } else { (info.duration / 2.0).min(1.0) };
    let binary = probe::binary("ffmpeg").ok_or("FFmpeg indisponível para gerar miniatura.")?;
    let result = Command::new(binary).args(["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-ss", &time.to_string(), "-i"])
        .arg(&input).args(["-vf", "scale=160:-2", "-frames:v", "1", "-threads", "1"]).arg(&output).output()
        .map_err(|error| error.to_string())?;
    if !result.status.success() {
        let _ = fs::remove_file(&output);
        return Err(format!("Não foi possível gerar a miniatura: {}", String::from_utf8_lossy(&result.stderr)));
    }
    Ok(output.to_string_lossy().into_owned())
}

#[cfg(feature = "desktop")]
#[tauri::command]
pub async fn generate_thumbnail(app: tauri::AppHandle, engine: tauri::State<'_, super::Engine>, path: String) -> Result<String, String> {
    let source = crate::storage::commands::authorize_path(&app, Path::new(&path))?;
    let cache = engine.0.cache.clone();
    tauri::async_runtime::spawn_blocking(move || thumbnail(&source.to_string_lossy(), &cache)).await.map_err(|error| error.to_string())?
}

#[cfg(feature = "desktop")]
#[tauri::command]
pub async fn clear_generated_cache(engine: tauri::State<'_, super::Engine>) -> Result<(), String> {
    if engine.active() { return Err("Aguarde ou cancele a fila antes de limpar o cache.".into()); }
    let cache = engine.0.cache.clone();
    tauri::async_runtime::spawn_blocking(move || {
        for directory in ["thumbnails", "previews", "export-assets", "tmp"] {
            let path = cache.join(directory);
            if path.exists() { fs::remove_dir_all(path).map_err(|error| error.to_string())?; }
        }
        Ok(())
    }).await.map_err(|error| error.to_string())?
}
