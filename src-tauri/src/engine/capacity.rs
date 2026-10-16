use super::model::{ExportJob, MediaInfo};
use std::{collections::BTreeMap, path::PathBuf};

pub fn estimated_bytes(info: &MediaInfo, duration: f64) -> u64 {
    if info.is_image { 2_000_000 } else {
        ((duration.max(0.0) * 2_000_000.0) as u64).min(info.size_bytes.saturating_mul(2).max(1_000_000))
    }
}
pub fn require_space(free: u64, estimated: u64) -> Result<(), String> {
    if free < estimated {
        Err(format!("Espaço em disco insuficiente: estimativa de {estimated} bytes, {free} disponíveis. Libere espaço ou escolha outra pasta."))
    } else { Ok(()) }
}
/// A conservative preflight; per-file checks and atomic cleanup still handle
/// concurrent disk use and failures after this estimate.
pub fn preflight(job: &ExportJob) -> Result<(), String> {
    let mut needs = BTreeMap::<PathBuf, u64>::new();
    for item in &job.items {
        let Some(parent) = std::path::Path::new(&item.output_path).parent().filter(|path| path.is_dir()) else { continue };
        let Ok(metadata) = std::fs::metadata(&item.source_path) else { continue };
        let estimate = if item.mode == "metadata" && !item.deep_clean { metadata.len() }
            else { item.trim.as_ref().filter(|trim| trim.duration.is_finite()).map(|trim| (trim.duration.max(0.0) * 2_000_000.0) as u64)
                .unwrap_or(metadata.len()).min(metadata.len().saturating_mul(2).max(1_000_000)) };
        let total = needs.entry(parent.to_path_buf()).or_default();
        *total = total.saturating_add(estimate);
    }
    for (directory, estimated) in needs { require_space(fs2::available_space(directory).map_err(|error| error.to_string())?, estimated)?; }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn simulated_full_disk_is_rejected_without_writing_or_removing_files() {
        assert!(require_space(0, 1).is_err());
        assert!(require_space(999, 1000).is_err());
        assert!(require_space(1000, 1000).is_ok());
        assert!(require_space(u64::MAX, 1).is_ok());
    }
}
