// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // Canvas consumes detached, muted video elements. WebKit must keep their
  // decoded frames, and playbin3 supports the independent seeks used by layers.
  // Configure GStreamer before Tauri starts any threads.
  #[cfg(target_os = "linux")]
  for (name, value) in [
    ("WEBKIT_GST_ALLOW_PLAYBACK_OF_INVISIBLE_VIDEOS", "1"),
    ("WEBKIT_GST_USE_PLAYBIN3", "1"),
  ] {
    if std::env::var_os(name).is_none() { std::env::set_var(name, value); }
  }
  app_lib::run();
}
