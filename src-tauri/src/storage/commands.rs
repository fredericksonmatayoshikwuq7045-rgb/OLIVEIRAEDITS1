use std::path::{Path, PathBuf};
use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_fs::FsExt;
use super::{canonical_target, grants::{ensure_internal_dir, PathGrant}, Storage};

pub fn store(app: &AppHandle) -> Result<Storage, String> {
    let storage = Storage::new(app.path().app_data_dir().map_err(|e| e.to_string())?,
        app.path().app_cache_dir().map_err(|e| e.to_string())?)?;
    ensure_internal_dir(&storage)?;
    Ok(storage)
}

/// Accept only app-owned paths or native-dialog grants. Persisting grants here means
/// a previously selected source remains usable after the application restarts.
pub fn authorize_path(app: &AppHandle, path: &Path) -> Result<PathBuf, String> {
    let canonical = canonical_target(path)?;
    let storage = store(app)?;
    if storage.owned_path(&canonical) || storage.is_granted(&canonical)? { return Ok(canonical); }
    let scope = app.fs_scope();
    if !scope.is_allowed(path) && !scope.is_allowed(&canonical) {
        return Err("Este caminho ainda não foi autorizado. Selecione o arquivo ou a pasta pelo seletor do aplicativo.".into());
    }
    let grant = PathGrant { directory: canonical.is_dir(), path: canonical.clone() };
    storage.add_grants(vec![grant.clone()])?;
    install_scope(app, &grant)?;
    Ok(canonical)
}

#[tauri::command]
pub fn storage_authorize_paths(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
    if paths.len() > 10000 { return Err("Selecione no máximo 10.000 caminhos por vez.".into()); }
    let storage = store(&app)?;
    let scope = app.fs_scope();
    let mut grants = Vec::with_capacity(paths.len());
    for source in paths {
        let path = Path::new(&source);
        let canonical = canonical_target(path)?;
        if !scope.is_allowed(path) && !scope.is_allowed(&canonical) && !storage.is_granted(&canonical)? {
            return Err("Caminho não autorizado pelo seletor de arquivos.".into());
        }
        grants.push(PathGrant { directory: canonical.is_dir(), path: canonical });
    }
    storage.add_grants(grants.clone())?;
    for grant in &grants { install_scope(&app, grant)?; }
    Ok(())
}

#[tauri::command]
pub async fn storage_read_json(app: AppHandle, relative_path: String) -> Result<Option<String>, String> {
    blocking(move || store(&app)?.read_json(&relative_path)).await
}

#[tauri::command]
pub async fn storage_write_json(app: AppHandle, relative_path: String, contents: String) -> Result<(), String> {
    blocking(move || store(&app)?.write_json(&relative_path, &contents)).await
}

#[tauri::command]
pub async fn storage_write_asset(app: AppHandle, relative_path: String, bytes: Vec<u8>) -> Result<String, String> {
    blocking(move || store(&app)?.write_asset(&relative_path, &bytes).map(|path| path.to_string_lossy().into_owned())).await
}

#[tauri::command]
pub async fn storage_read_asset(app: AppHandle, relative_path: String) -> Result<Vec<u8>, String> {
    blocking(move || store(&app)?.read_asset(&relative_path)).await
}

#[tauri::command]
pub async fn storage_import_asset(app: AppHandle, source_path: String, relative_path: String) -> Result<String, String> {
    blocking(move || {
        let source = authorize_path(&app, Path::new(&source_path))?;
        store(&app)?.import_asset(&source, &relative_path).map(|path| path.to_string_lossy().into_owned())
    }).await
}

#[tauri::command]
pub async fn storage_exists(app: AppHandle, path: String) -> Result<bool, String> {
    blocking(move || {
        let candidate = Path::new(&path);
        let canonical = if candidate.is_absolute() { authorize_path(&app, candidate)? } else { store(&app)?.resolve(&path)? };
        Ok(canonical.is_file())
    }).await
}

#[tauri::command]
pub async fn storage_log_error(app: AppHandle, message: String) -> Result<(), String> {
    blocking(move || store(&app)?.log_error(&message)).await
}

#[tauri::command]
pub async fn storage_export_image(app: AppHandle, source_path: Option<String>, output_dir: String,
    filename: String, bytes: Vec<u8>, conflict: String) -> Result<super::images::ImageExportResult, String>
{
    blocking(move || {
        let directory = authorize_path(&app, Path::new(&output_dir))?;
        let source = source_path.map(|path| authorize_path(&app, Path::new(&path))).transpose()?;
        super::images::export_image(source.as_deref(), &directory, &filename, &bytes, &conflict)
    }).await
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoragePaths { data_dir: String, cache_dir: String, log_dir: String, engine_log_dir: String, app_log_dir: String }

#[tauri::command]
pub fn storage_get_paths(app: AppHandle) -> Result<StoragePaths, String> {
    let storage = store(&app)?;
    let logs = storage.data_dir.join("logs");
    super::paths::reject_symlink_ancestors(&storage.data_dir, &logs)?;
    std::fs::create_dir_all(&logs).map_err(|e| e.to_string())?;
    Ok(StoragePaths { data_dir: display(&storage.data_dir), cache_dir: display(&storage.cache_dir),
        log_dir: display(&logs), engine_log_dir: display(&storage.cache_dir.join("export-engine/logs")),
        app_log_dir: display(&app.path().app_log_dir().map_err(|e| e.to_string())?) })
}

fn display(path: &Path) -> String { path.to_string_lossy().into_owned() }

async fn blocking<T: Send + 'static>(work: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(work).await.map_err(|error| error.to_string())?
}

/// Reinstall only exact persisted grants in plugin scope so native asset URLs can
/// display the same user-selected media after a restart.
pub fn restore_scopes(app: &AppHandle) -> Result<(), String> {
    let storage = store(app)?;
    for grant in storage.grants()? { install_scope(app, &grant)?; }
    Ok(())
}

fn install_scope(app: &AppHandle, grant: &PathGrant) -> Result<(), String> {
    for scope in [app.fs_scope(), app.asset_protocol_scope()] {
        if grant.directory { scope.allow_directory(&grant.path, true).map_err(|e| e.to_string())?; }
        else { scope.allow_file(&grant.path).map_err(|e| e.to_string())?; }
    }
    Ok(())
}

/// Only called by the trusted native window drop event, never by a frontend command.
pub fn authorize_native_drop(app: &AppHandle, paths: &[PathBuf]) -> Result<(), String> {
    let storage = store(app)?;
    let mut grants = Vec::new();
    for path in paths {
        let canonical = path.canonicalize().map_err(|error| error.to_string())?;
        if !canonical.is_file() { continue; }
        let extension = canonical.extension().and_then(|value| value.to_str()).unwrap_or("").to_lowercase();
        if !["mp4","m4v","mov","mkv","avi","webm","wmv","mpg","mpeg","png","jpg","jpeg","webp","gif","bmp","tiff","tif","avif"].contains(&extension.as_str()) { continue; }
        let grant = PathGrant { path: canonical, directory: false };
        install_scope(app, &grant)?;
        grants.push(grant);
    }
    storage.add_grants(grants)
}
