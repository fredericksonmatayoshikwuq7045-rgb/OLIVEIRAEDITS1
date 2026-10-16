use std::{fs, path::PathBuf, sync::atomic::{AtomicU64, Ordering}};
use super::export_image;

static NEXT: AtomicU64 = AtomicU64::new(0);
const PNG: &[u8] = b"\x89PNG\r\n\x1a\ncanvas result";
struct Workspace(PathBuf);
impl Workspace {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("oliveira-image-{}-{}", std::process::id(), NEXT.fetch_add(1, Ordering::Relaxed)));
        fs::create_dir_all(&path).unwrap();
        Self(path)
    }
}
impl Drop for Workspace { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); } }

#[test]
fn original_is_preserved_even_when_overwrite_was_selected() {
    let workspace = Workspace::new();
    let source = workspace.0.join("original.png");
    fs::write(&source, b"original unchanged").unwrap();
    for conflict in ["overwrite", "skip", "suffix"] {
        assert!(export_image(Some(&source), &workspace.0, "original.png", PNG, conflict).is_err());
        assert_eq!(fs::read(&source).unwrap(), b"original unchanged");
    }
}

#[test]
fn complete_output_is_published_and_source_is_retained() {
    let workspace = Workspace::new();
    let source = workspace.0.join("original.png");
    fs::write(&source, b"original unchanged").unwrap();
    let result = export_image(Some(&source), &workspace.0, "edited.png", PNG, "overwrite").unwrap();
    assert_eq!(result.status, "ok");
    assert_eq!(fs::read(result.path.unwrap()).unwrap(), PNG);
    assert_eq!(fs::read(source).unwrap(), b"original unchanged");
    assert_eq!(fs::read_dir(&workspace.0).unwrap().count(), 2);
}

#[test]
fn conflicts_skip_or_suffix_existing_export() {
    let workspace = Workspace::new();
    let output = workspace.0.join("edited.png");
    fs::write(&output, b"existing export").unwrap();
    let skipped = export_image(None, &workspace.0, "edited.png", PNG, "skip").unwrap();
    assert_eq!(skipped.status, "skipped");
    assert!(skipped.path.is_none());
    assert_eq!(fs::read(&output).unwrap(), b"existing export");
    let suffixed = export_image(None, &workspace.0, "edited.png", PNG, "suffix").unwrap();
    assert!(suffixed.path.unwrap().ends_with("edited_2.png"));
    assert_eq!(fs::read(output).unwrap(), b"existing export");
}

#[test]
fn existing_export_can_be_replaced_atomically_with_a_known_different_source() {
    let workspace = Workspace::new();
    let source = workspace.0.join("source.png");
    let output = workspace.0.join("edited.png");
    fs::write(&source, b"source").unwrap();
    fs::write(&output, b"old export").unwrap();
    export_image(Some(&source), &workspace.0, "edited.png", PNG, "overwrite").unwrap();
    assert_eq!(fs::read(output).unwrap(), PNG);
    assert_eq!(fs::read(source).unwrap(), b"source");
}

#[test]
fn missing_source_identity_cannot_overwrite_existing_files() {
    let workspace = Workspace::new();
    let output = workspace.0.join("existing.png");
    fs::write(&output, b"preserve").unwrap();
    assert!(export_image(None, &workspace.0, "existing.png", PNG, "overwrite").is_err());
    assert_eq!(fs::read(output).unwrap(), b"preserve");
}

#[test]
fn invalid_signature_and_names_leave_no_files() {
    let workspace = Workspace::new();
    for name in ["../image.png", "subdir/image.png", "C:\\image.png", "image.exe", "CON.png"] {
        assert!(export_image(None, &workspace.0, name, PNG, "suffix").is_err());
    }
    assert!(export_image(None, &workspace.0, "image.jpg", PNG, "suffix").is_err());
    assert!(export_image(None, &workspace.0, "image.png", b"not png", "suffix").is_err());
    assert_eq!(fs::read_dir(&workspace.0).unwrap().count(), 0);
}

#[test]
fn replacement_failure_keeps_the_previous_export_and_cleans_temporary() {
    let workspace = Workspace::new();
    let source = workspace.0.join("original.png");
    let output = workspace.0.join("edited.png");
    fs::write(&source, b"original").unwrap();
    fs::write(&output, b"previous export").unwrap();
    // A symlink backup is rejected before publishing, even though no backup is
    // needed for exported images. This induces the same safe failure path.
    #[cfg(unix)] {
        std::os::unix::fs::symlink(&source, workspace.0.join("edited.png.bak")).unwrap();
        assert!(export_image(Some(&source), &workspace.0, "edited.png", PNG, "overwrite").is_err());
        assert_eq!(fs::read(&output).unwrap(), b"previous export");
        assert_eq!(fs::read_dir(&workspace.0).unwrap().count(), 3);
    }
    #[cfg(not(unix))] {
        fs::create_dir(&output).unwrap_err();
        assert!(export_image(Some(&source), &workspace.0.join("missing"), "edited.png", PNG, "overwrite").is_err());
        assert_eq!(fs::read(&output).unwrap(), b"previous export");
    }
    assert_eq!(fs::read(source).unwrap(), b"original");
}

#[cfg(unix)]
#[test]
fn output_symlink_cannot_replace_original_or_escape_chosen_folder() {
    let workspace = Workspace::new();
    let source = workspace.0.join("source.png");
    fs::write(&source, b"original").unwrap();
    std::os::unix::fs::symlink(&source, workspace.0.join("edited.png")).unwrap();
    assert!(export_image(Some(&source), &workspace.0, "edited.png", PNG, "overwrite").is_err());
    assert_eq!(fs::read(source).unwrap(), b"original");
}
