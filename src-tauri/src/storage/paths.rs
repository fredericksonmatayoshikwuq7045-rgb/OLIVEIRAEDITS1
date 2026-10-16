use std::{fs, path::{Component, Path, PathBuf}};

pub fn relative_path(root: &Path, relative: &str) -> Result<PathBuf, String> {
    if relative.is_empty() || relative.len() > 1024 || relative.contains('\\') {
        return Err("Caminho relativo inválido.".into());
    }
    let path = Path::new(relative);
    for part in path.components() {
        let Component::Normal(name) = part else {
            return Err("O caminho não pode sair da pasta de dados do aplicativo.".into());
        };
        let text = name.to_string_lossy();
        let stem = text.split('.').next().unwrap_or("").to_ascii_uppercase();
        let reserved = matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
            || (stem.len() == 4 && (stem.starts_with("COM") || stem.starts_with("LPT"))
                && stem.as_bytes()[3].is_ascii_digit());
        if text.starts_with('.') || text.ends_with(['.', ' ']) || text.contains(':')
            || text.chars().any(char::is_control) || reserved
        {
            return Err("O nome do arquivo contém caracteres ou nomes reservados.".into());
        }
    }
    // Path::components normalizes embedded ./, so reject it explicitly as well.
    if relative.split('/').any(|part| part.is_empty() || part == "." || part == "..") {
        return Err("O caminho contém segmentos inválidos.".into());
    }
    let target = root.join(path);
    reject_symlink_ancestors(root, &target)?;
    Ok(target)
}

pub fn reject_symlink_ancestors(root: &Path, target: &Path) -> Result<(), String> {
    let tail = target.strip_prefix(root).map_err(|_| "Caminho fora da pasta permitida.")?;
    let mut cursor = root.to_path_buf();
    for part in tail.components() {
        cursor.push(part);
        match fs::symlink_metadata(&cursor) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err("Links simbólicos não são permitidos dentro dos dados do aplicativo.".into());
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(format!("Não foi possível verificar o caminho: {error}")),
        }
    }
    Ok(())
}

pub fn canonical_target(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() || path.components().any(|p| matches!(p, Component::ParentDir | Component::CurDir)) {
        return Err("Selecione um caminho absoluto válido pelo seletor de arquivos.".into());
    }
    if path.exists() {
        return path.canonicalize().map_err(|e| format!("Não foi possível acessar o arquivo: {e}"));
    }
    // A moved/deleted parent folder is still a missing source, rather than a
    // fatal workspace-loading error. Resolve the nearest surviving ancestor.
    let mut cursor = path.to_path_buf();
    let mut missing = Vec::new();
    while !cursor.exists() {
        let name = cursor.file_name().ok_or("O caminho não tem uma pasta válida.")?;
        let text = name.to_string_lossy();
        if text.contains(':') || text.chars().any(char::is_control) { return Err("Nome de arquivo inválido.".into()); }
        missing.push(name.to_os_string());
        if !cursor.pop() { return Err("O caminho não tem uma pasta válida.".into()); }
    }
    let mut canonical = cursor.canonicalize().map_err(|e| format!("A pasta não está disponível: {e}"))?;
    for name in missing.into_iter().rev() { canonical.push(name); }
    Ok(canonical)
}
