use std::{fs::{self, OpenOptions}, io::Write, path::{Path, PathBuf}, sync::atomic::{AtomicU64, Ordering}};

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

pub fn backup_path(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(suffix);
    PathBuf::from(name)
}

struct PendingFile(PathBuf);
impl Drop for PendingFile {
    fn drop(&mut self) { let _ = fs::remove_file(&self.0); }
}

pub fn write_atomic(path: &Path, contents: &[u8], rotate_backups: bool) -> Result<(), String> {
    for candidate in [path.to_path_buf(), backup_path(path, ".bak"), backup_path(path, ".bak.1")] {
        if fs::symlink_metadata(candidate).map(|meta| meta.file_type().is_symlink()).unwrap_or(false) {
            return Err("Links simbólicos não são permitidos no destino ou nos backups.".into());
        }
    }
    let parent = path.parent().ok_or("O arquivo não tem pasta de destino.")?;
    fs::create_dir_all(parent).map_err(|e| format!("Não foi possível criar a pasta: {e}"))?;
    let temp = parent.join(format!(".oe-{}-{}.tmp", std::process::id(), TEMP_COUNTER.fetch_add(1, Ordering::Relaxed)));
    let pending = PendingFile(temp);
    let mut file = OpenOptions::new().write(true).create_new(true).open(&pending.0)
        .map_err(|e| format!("Não foi possível criar o arquivo temporário: {e}"))?;
    file.write_all(contents).and_then(|_| file.sync_all())
        .map_err(|e| format!("Falha ao salvar; o arquivo anterior foi preservado: {e}"))?;
    drop(file);
    if rotate_backups && path.exists() {
        let backup = backup_path(path, ".bak");
        if backup.exists() {
            atomic_copy(&backup, &backup_path(path, ".bak.1"))?;
        }
        atomic_copy(path, &backup)?;
    }
    atomic_replace(&pending.0, path)
        .map_err(|e| format!("Falha na gravação atômica; o arquivo anterior foi preservado: {e}"))?;
    // Sync the directory entry where supported. Windows directories cannot be opened this way.
    #[cfg(unix)]
    if let Ok(directory) = fs::File::open(parent) { let _ = directory.sync_all(); }
    Ok(())
}

fn atomic_copy(source: &Path, target: &Path) -> Result<(), String> {
    let bytes = fs::read(source).map_err(|e| format!("Não foi possível preservar o backup: {e}"))?;
    write_atomic(target, &bytes, false)
}

pub fn atomic_replace(source: &Path, target: &Path) -> Result<(), String> {
    if source.parent() != target.parent() {
        return Err("A substituição atômica exige arquivos na mesma pasta.".into());
    }
    for path in [source, target] {
        if fs::symlink_metadata(path).map(|meta| meta.file_type().is_symlink()).unwrap_or(false) {
            return Err("A substituição atômica não permite links simbólicos.".into());
        }
    }
    replace(source, target).map_err(|error| error.to_string())
}

#[cfg(not(windows))]
fn replace(source: &Path, target: &Path) -> std::io::Result<()> { fs::rename(source, target) }

#[cfg(windows)]
fn replace(source: &Path, target: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    #[link(name = "kernel32")]
    extern "system" {
        fn MoveFileExW(existing: *const u16, replacement: *const u16, flags: u32) -> i32;
    }
    let source: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let target: Vec<u16> = target.as_os_str().encode_wide().chain(Some(0)).collect();
    // Same-directory move, replacing the destination without a delete-first loss window.
    let success = unsafe { MoveFileExW(source.as_ptr(), target.as_ptr(), 0x1 | 0x8) };
    if success == 0 { Err(std::io::Error::last_os_error()) } else { Ok(()) }
}
