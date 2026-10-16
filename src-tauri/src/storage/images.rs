use std::path::{Path, PathBuf};
use serde::Serialize;
use super::{atomic::write_atomic, paths, IO_LOCK};

const MAX_IMAGE_BYTES: usize = 64 * 1024 * 1024;

#[derive(Debug, Serialize)]
pub struct ImageExportResult {
    pub path: Option<String>,
    pub status: &'static str,
}

/// Publish a complete canvas image without modifying the original media. The
/// caller authorizes the canonical folder and source through the native scope.
pub fn export_image(source: Option<&Path>, directory: &Path, filename: &str,
    bytes: &[u8], conflict: &str) -> Result<ImageExportResult, String>
{
    if !["overwrite", "skip", "suffix"].contains(&conflict) {
        return Err("Política de conflito inválida.".into());
    }
    if bytes.is_empty() || bytes.len() > MAX_IMAGE_BYTES {
        return Err("A imagem deve ter entre 1 byte e 64 MiB.".into());
    }
    if filename.contains('/') || filename.contains('\\') || filename.len() > 255 {
        return Err("Informe apenas um nome de arquivo, sem pastas.".into());
    }
    let directory = directory.canonicalize().map_err(|e| format!("A pasta de saída não está disponível: {e}"))?;
    if !directory.is_dir() { return Err("A saída precisa ser uma pasta existente.".into()); }
    let original = paths::relative_path(&directory, filename)?;
    validate_signature(&original, bytes)?;
    let source = source.map(|path| path.canonicalize().map_err(|e| format!("A mídia original não está disponível: {e}"))).transpose()?;
    if source.as_ref().is_some_and(|path| !path.is_file()) { return Err("A mídia original precisa ser um arquivo.".into()); }
    let _lock = IO_LOCK.lock().map_err(|_| "A gravação está temporariamente indisponível.")?;
    // Check before applying skip/suffix too: the UI must make a fresh naming
    // decision instead of silently choosing a destructive source destination.
    if original.exists() && source.as_ref().is_some_and(|path| original.canonicalize().ok().as_ref() == Some(path)) {
        return Err("A saída coincide com a mídia original. Escolha outro nome ou outra pasta; o original foi preservado.".into());
    }
    let mut output = original.clone();
    if output.exists() {
        if !output.is_file() { return Err("Já existe uma pasta com esse nome. Escolha outro nome de saída.".into()); }
        if conflict == "skip" { return Ok(ImageExportResult { path: None, status: "skipped" }); }
        if conflict == "overwrite" && source.is_none() {
            return Err("Não foi possível identificar a mídia original. Use outro nome para preservar os arquivos existentes.".into());
        }
        if conflict == "suffix" { output = available_suffix(&original)?; }
    }
    write_atomic(&output, bytes, false)?;
    Ok(ImageExportResult { path: Some(output.to_string_lossy().into_owned()), status: "ok" })
}

fn available_suffix(original: &Path) -> Result<PathBuf, String> {
    let parent = original.parent().ok_or("Pasta de saída inválida.")?;
    let stem = original.file_stem().ok_or("Nome de arquivo inválido.")?.to_string_lossy();
    let extension = original.extension().ok_or("Formato de imagem inválido.")?.to_string_lossy();
    for number in 2..10000 {
        let candidate = parent.join(format!("{stem}_{number}.{extension}"));
        if !candidate.exists() { return Ok(candidate); }
    }
    Err("Há arquivos demais com esse nome. Altere o padrão de saída.".into())
}

fn validate_signature(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let extension = path.extension().and_then(|ext| ext.to_str()).unwrap_or("").to_ascii_lowercase();
    let valid = match extension.as_str() {
        "png" => bytes.starts_with(b"\x89PNG\r\n\x1a\n"),
        "jpg" | "jpeg" => bytes.starts_with(b"\xff\xd8\xff"),
        "webp" => bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP",
        _ => return Err("Exporte a imagem como PNG, JPG ou WebP.".into()),
    };
    if valid { Ok(()) } else { Err("A imagem gerada não corresponde ao formato escolhido. Tente exportar novamente.".into()) }
}

#[cfg(test)]
mod tests;
