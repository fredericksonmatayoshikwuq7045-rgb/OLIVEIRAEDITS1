use std::process::Command;
use std::path::PathBuf;

#[tauri::command]
async fn run_ffmpeg(args: Vec<String>) -> Result<String, String> {
  let mut ffmpeg_path = PathBuf::from("ffmpeg");
  
  if let Ok(exe_path) = std::env::current_exe() {
    if let Some(exe_dir) = exe_path.parent() {
      let local_ffmpeg = exe_dir.join("ffmpeg.exe");
      if local_ffmpeg.exists() {
        ffmpeg_path = local_ffmpeg;
      }
    }
  }

  let output = Command::new(ffmpeg_path)
    .args(&args)
    .output();

  match output {
    Ok(out) => {
      if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).to_string())
      } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
      }
    }
    Err(e) => Err(format!("Falha ao executar o FFmpeg: {}. Certifique-se de que o 'ffmpeg.exe' está na mesma pasta do aplicativo ou no PATH do sistema.", e)),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![run_ffmpeg])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
