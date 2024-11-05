mod commands;
mod migrations;

use migrations::get_migrations;
use commands::process_markdown;
// use datastructure::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let migrations = get_migrations();

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::
          default()
          .add_migrations("sqlite:ekandata.db", migrations)
          .build())
        .plugin(tauri_plugin_dialog::init())
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
        .invoke_handler(tauri::generate_handler![
            process_markdown,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
