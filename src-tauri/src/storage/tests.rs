use std::{fs, path::{Path, PathBuf}, sync::atomic::{AtomicU64, Ordering}};
use super::{atomic::backup_path, canonical_target, grants::PathGrant, read_bounded, Storage};

static NEXT_TEST: AtomicU64 = AtomicU64::new(0);
struct TestStorage { root: PathBuf, storage: Storage }
impl TestStorage {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("oliveira-storage-{}-{}", std::process::id(), NEXT_TEST.fetch_add(1, Ordering::Relaxed)));
        fs::create_dir_all(&root).unwrap();
        let storage = Storage::new(root.join("data"), root.join("cache")).unwrap();
        Self { root, storage }
    }
}
impl Drop for TestStorage { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.root); } }

#[test]
fn writes_json_atomically_and_retains_two_previous_versions() {
    let test = TestStorage::new();
    for revision in 1..=3 { test.storage.write_json("settings.json", &format!("{{\"revision\":{revision}}}")).unwrap(); }
    let path = test.storage.resolve("settings.json").unwrap();
    assert_eq!(fs::read_to_string(&path).unwrap(), "{\"revision\":3}");
    assert_eq!(fs::read_to_string(backup_path(&path, ".bak")).unwrap(), "{\"revision\":2}");
    assert_eq!(fs::read_to_string(backup_path(&path, ".bak.1")).unwrap(), "{\"revision\":1}");
    assert_eq!(fs::read_dir(&test.storage.data_dir).unwrap().count(), 3);
}

#[test]
fn malformed_save_leaves_original_unchanged() {
    let test = TestStorage::new();
    test.storage.write_json("settings.json", "{\"ok\":true}").unwrap();
    assert!(test.storage.write_json("settings.json", "invalid").is_err());
    assert_eq!(test.storage.read_json("settings.json").unwrap().unwrap(), "{\"ok\":true}");
}

#[test]
fn failed_backup_preserves_previous_primary_and_leaves_no_temporary() {
    let test = TestStorage::new();
    test.storage.write_json("settings.json", "{\"revision\":1}").unwrap();
    let path = test.storage.resolve("settings.json").unwrap();
    fs::create_dir(backup_path(&path, ".bak")).unwrap();
    assert!(test.storage.write_json("settings.json", "{\"revision\":2}").is_err());
    assert_eq!(fs::read_to_string(&path).unwrap(), "{\"revision\":1}");
    assert_eq!(fs::read_dir(&test.storage.data_dir).unwrap().count(), 2);
}

#[test]
fn partial_output_replaces_existing_file_without_delete_first() {
    let test = TestStorage::new();
    let original = test.root.join("output.mp4");
    let partial = test.root.join("output.mp4.part");
    fs::write(&original, b"old complete output").unwrap();
    fs::write(&partial, b"new complete output").unwrap();
    super::atomic_replace(&partial, &original).unwrap();
    assert_eq!(fs::read(&original).unwrap(), b"new complete output");
    assert!(!partial.exists());
    assert!(super::atomic_replace(&test.root.join("missing.part"), &original).is_err());
    assert_eq!(fs::read(original).unwrap(), b"new complete output");
}

#[test]
fn corrupt_primary_recovers_backup_without_deleting_primary() {
    let test = TestStorage::new();
    test.storage.write_json("settings.json", "{\"revision\":1}").unwrap();
    test.storage.write_json("settings.json", "{\"revision\":2}").unwrap();
    let path = test.storage.resolve("settings.json").unwrap();
    fs::write(&path, "corrupt").unwrap();
    assert_eq!(test.storage.read_json("settings.json").unwrap().unwrap(), "{\"revision\":1}");
    assert_eq!(fs::read_to_string(path).unwrap(), "corrupt");
}

#[test]
fn absent_state_is_none_but_unrecoverable_corruption_is_error() {
    let test = TestStorage::new();
    assert!(test.storage.read_json("settings.json").unwrap().is_none());
    fs::write(test.storage.resolve("settings.json").unwrap(), "bad").unwrap();
    assert!(test.storage.read_json("settings.json").is_err());
}

#[test]
fn rejects_traversal_absolute_and_windows_special_paths() {
    let test = TestStorage::new();
    for bad in ["../outside.json", "/tmp/file.json", "profiles/../../outside", "profiles\\evil.json", "C:/file.json",
        "profiles/./state.json", "profiles//state.json", ".internal/path-grants.json", "profiles/CON.png", "profiles/x:stream", "profiles/test. "] {
        assert!(test.storage.resolve(bad).is_err(), "should reject {bad}");
    }
    assert!(test.storage.resolve("profiles/conta-01/assets/logo.png").is_ok());
}

#[test]
fn import_copies_asset_without_deleting_original() {
    let test = TestStorage::new();
    let source = test.root.join("logo.png");
    fs::write(&source, b"original asset bytes").unwrap();
    let result = test.storage.import_asset(&source, "profiles/example/assets/logo.png").unwrap();
    assert_eq!(fs::read(source).unwrap(), b"original asset bytes");
    assert_eq!(fs::read(result).unwrap(), b"original asset bytes");
    assert_eq!(test.storage.read_asset("profiles/example/assets/logo.png").unwrap(), b"original asset bytes");
}

#[test]
fn assets_cannot_overwrite_json_or_executables() {
    let test = TestStorage::new();
    for bad in ["settings.json", "profiles/example/assets/run.exe", "profiles/example/profile.json"] {
        assert!(test.storage.write_asset(bad, b"bad").is_err());
    }
}

#[test]
fn size_limits_reject_large_sparse_files_without_reading_into_memory() {
    let test = TestStorage::new();
    let source = test.root.join("large.png");
    fs::File::create(&source).unwrap().set_len(super::MAX_ASSET_BYTES + 1).unwrap();
    assert!(test.storage.import_asset(&source, "profiles/example/assets/large.png").is_err());
    assert!(read_bounded(&test.root, 1024).is_err());
    assert!(source.exists());
}

#[test]
fn exact_file_and_selected_directory_grants_remain_separate() {
    let test = TestStorage::new();
    let file = test.root.join("original.mp4");
    let directory = test.root.join("chosen-output");
    test.storage.add_grants(vec![PathGrant { path: file.clone(), directory: false }, PathGrant { path: directory.clone(), directory: true }]).unwrap();
    assert!(test.storage.is_granted(&file).unwrap());
    assert!(!test.storage.is_granted(&test.root.join("different.mp4")).unwrap());
    assert!(test.storage.is_granted(&directory.join("subdir/export.mp4")).unwrap());
    assert!(!test.storage.is_granted(&test.root.join("chosen-output-not-selected/video.mp4")).unwrap());
    assert!(test.storage.resolve(".internal/path-grants.json").is_err());
    let reopened = Storage::new(test.storage.data_dir.clone(), test.storage.cache_dir.clone()).unwrap();
    assert!(reopened.is_granted(&file).unwrap());
}

#[test]
fn output_target_can_be_authorized_before_creation() {
    let test = TestStorage::new();
    let target = test.root.join("new.mp4");
    assert_eq!(canonical_target(&target).unwrap(), target);
    assert!(canonical_target(Path::new("relative.mp4")).is_err());
    assert!(canonical_target(&test.root.join("../escape.mp4")).is_err());
    assert_eq!(canonical_target(&test.root.join("moved/parent/source.mp4")).unwrap(), test.root.join("moved/parent/source.mp4"));
}

#[test]
fn simultaneous_saves_are_complete_valid_json() {
    let test = TestStorage::new();
    std::thread::scope(|scope| {
        for revision in 0..8 {
            let storage = &test.storage;
            scope.spawn(move || storage.write_json("settings.json", &format!("{{\"revision\":{revision}}}")).unwrap());
        }
    });
    let path = test.storage.resolve("settings.json").unwrap();
    for candidate in [path.clone(), backup_path(&path, ".bak"), backup_path(&path, ".bak.1")] {
        let state: serde_json::Value = serde_json::from_slice(&fs::read(candidate).unwrap()).unwrap();
        assert!(state["revision"].as_u64().unwrap() < 8);
    }
    assert_eq!(fs::read_dir(&test.storage.data_dir).unwrap().count(), 3);
}

#[test]
fn logs_preserve_unicode_and_strip_unsafe_controls() {
    let test = TestStorage::new();
    test.storage.log_error("Falha na exportação\0\nTente novamente").unwrap();
    let text = fs::read_to_string(test.storage.data_dir.join("logs/frontend.log")).unwrap();
    assert!(text.contains("Falha na exportação\nTente novamente"));
    assert!(!text.contains('\0'));
}

#[test]
fn logs_rotate_two_backup_generations() {
    let test = TestStorage::new();
    test.storage.log_error("primeiro").unwrap();
    let path = test.storage.data_dir.join("logs/frontend.log");
    fs::write(&path, vec![b'a'; 2 * 1024 * 1024 + 1]).unwrap();
    test.storage.log_error("segundo").unwrap();
    assert_eq!(fs::metadata(backup_path(&path, ".bak")).unwrap().len(), 2 * 1024 * 1024 + 1);
    assert!(fs::read_to_string(&path).unwrap().contains("segundo"));
    fs::write(&path, vec![b'b'; 2 * 1024 * 1024 + 2]).unwrap();
    test.storage.log_error("terceiro").unwrap();
    assert_eq!(fs::metadata(backup_path(&path, ".bak.1")).unwrap().len(), 2 * 1024 * 1024 + 1);
    assert!(fs::read_to_string(path).unwrap().contains("terceiro"));
}

#[cfg(unix)]
#[test]
fn symlink_escape_in_data_or_backups_is_rejected() {
    use std::os::unix::fs::symlink;
    let test = TestStorage::new();
    let outside = test.root.join("outside");
    fs::create_dir(&outside).unwrap();
    symlink(&outside, test.storage.data_dir.join("profiles")).unwrap();
    assert!(test.storage.write_json("profiles/project.json", "{}").is_err());
    fs::write(outside.join("secret.json"), "{\"secret\":1}").unwrap();
    symlink(outside.join("secret.json"), test.storage.data_dir.join("settings.json.bak")).unwrap();
    assert!(test.storage.read_json("settings.json").is_err());
    assert!(test.storage.write_json("settings.json", "{}").is_err());
    assert!(!outside.join("project.json").exists());
}
