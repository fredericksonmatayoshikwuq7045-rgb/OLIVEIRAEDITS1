pub mod engine;
pub mod storage;

#[cfg(feature="desktop")]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::{Emitter,Manager};
    use engine::commands::*;
    use engine::media_tools::{generate_thumbnail, clear_generated_cache};
    use storage::commands::*;
    let app=tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).max_file_size(2_000_000).rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(5)).build())
        .invoke_handler(tauri::generate_handler![
            get_ffmpeg_info,probe_media,start_export,cancel_export,cancel_all,get_queue_state,
            pause_export,resume_export,clean_metadata_only,cache_asset,render_preview,crop_detect,
            open_authorized_path,confirm_close,
            generate_thumbnail,clear_generated_cache,
            storage_read_json,storage_write_json,storage_write_asset,storage_read_asset,
            storage_import_asset,storage_exists,storage_log_error,storage_get_paths,storage_authorize_paths,storage_export_image
        ])
        .setup(|app|{
            restore_scopes(app.handle()).map_err(std::io::Error::other)?;
            let handle=app.handle().clone();
            let emitter=std::sync::Arc::new(move|event:&str,value:serde_json::Value|{let _=handle.emit(event,value);});
            let cache=app.path().app_cache_dir()?.join("export-engine");
            let engine=engine::Engine::new(cache,emitter).map_err(std::io::Error::other)?;
            app.manage(engine);
            Ok(())
        })
        .on_window_event(|window,event|{
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                if let Err(error) = authorize_native_drop(window.app_handle(), paths) {
                    let _ = window.emit("export://warning", serde_json::json!({"message": error}));
                }
            }
            if let tauri::WindowEvent::CloseRequested{api,..}=event {
                let Some(engine)=window.try_state::<engine::Engine>() else{return;};
                if engine.active(){api.prevent_close();let _=window.emit("export://close-requested",());}
            }
        })
        .build(tauri::generate_context!()).expect("Falha ao inicializar Oliveira Edits");
    app.run(|handle,event|{
        let Some(engine)=handle.try_state::<engine::Engine>() else{return;};
        match event {
            tauri::RunEvent::ExitRequested{api,..} if engine.active()=>{api.prevent_exit();let _=handle.emit("export://close-requested",());},
            tauri::RunEvent::Exit=>engine.cancel_all(),
            _=>{}
        }
    });
}
