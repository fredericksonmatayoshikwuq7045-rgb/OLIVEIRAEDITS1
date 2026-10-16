use std::{fs, path::{Path, PathBuf}};
use serde::{Deserialize, Serialize};
use super::{atomic::{backup_path, write_atomic}, read_bounded, Storage, IO_LOCK};

const GRANT_LIMIT: usize = 10000;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct PathGrant {
    pub path: PathBuf,
    pub directory: bool,
}

impl Storage {
    pub fn add_grants(&self, additions: Vec<PathGrant>) -> Result<(), String> {
        ensure_internal_dir(self)?;
        let _lock = IO_LOCK.lock().map_err(|_| "As permissões estão temporariamente indisponíveis.")?;
        let path = self.data_dir.join(".internal/path-grants.json");
        let mut grants = load_grants(&path)?;
        for grant in additions {
            if !grant.path.is_absolute() { return Err("A permissão exige um caminho absoluto.".into()); }
            if !grants.contains(&grant) { grants.push(grant); }
        }
        if grants.len() > GRANT_LIMIT { return Err("O limite de caminhos autorizados foi atingido.".into()); }
        let bytes = serde_json::to_vec(&grants).map_err(|e| e.to_string())?;
        write_atomic(&path, &bytes, true)
    }

    pub fn is_granted(&self, path: &Path) -> Result<bool, String> {
        ensure_internal_dir(self)?;
        let _lock = IO_LOCK.lock().map_err(|_| "As permissões estão temporariamente indisponíveis.")?;
        let grants = load_grants(&self.data_dir.join(".internal/path-grants.json"))?;
        Ok(grants.iter().any(|grant| path == grant.path || (grant.directory && path.starts_with(&grant.path))))
    }

    pub fn owned_path(&self, path: &Path) -> bool {
        path.starts_with(&self.data_dir) || path.starts_with(&self.cache_dir)
    }

    pub fn grants(&self) -> Result<Vec<PathGrant>, String> {
        ensure_internal_dir(self)?;
        let _lock = IO_LOCK.lock().map_err(|_| "As permissões estão temporariamente indisponíveis.")?;
        load_grants(&self.data_dir.join(".internal/path-grants.json"))
    }
}

fn load_grants(path: &Path) -> Result<Vec<PathGrant>, String> {
    let mut error = None;
    for candidate in [path.to_path_buf(), backup_path(path, ".bak"), backup_path(path, ".bak.1")] {
        if !candidate.exists() { continue; }
        if fs::symlink_metadata(&candidate).map(|meta| meta.file_type().is_symlink()).unwrap_or(false) {
            return Err("O registro de permissões não pode ser um link simbólico.".into());
        }
        match read_bounded(&candidate, 8 * 1024 * 1024)
            .and_then(|bytes| serde_json::from_slice::<Vec<PathGrant>>(&bytes).map_err(|e| e.to_string()))
        {
            Ok(grants) if grants.len() <= GRANT_LIMIT => return Ok(grants),
            Ok(_) => error = Some("O registro de permissões excede o limite.".to_string()),
            Err(message) => error = Some(message),
        }
    }
    match error { Some(error) => Err(format!("Não foi possível ler as permissões salvas: {error}")), None => Ok(Vec::new()) }
}

pub fn ensure_internal_dir(storage: &Storage) -> Result<(), String> {
    let path = storage.data_dir.join(".internal");
    if fs::symlink_metadata(&path).map(|meta| meta.file_type().is_symlink()).unwrap_or(false) {
        return Err("A pasta interna não pode ser um link simbólico.".into());
    }
    fs::create_dir_all(path).map_err(|e| e.to_string())
}
