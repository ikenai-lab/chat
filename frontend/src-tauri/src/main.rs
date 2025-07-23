#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use std::path::PathBuf;
use tauri::{Manager, path::BaseDirectory};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let backend_path: PathBuf = if cfg!(debug_assertions) {
                // Dev mode: backend is in src-tauri/binaries/
                app.path()
                    .resolve("binaries/backend-x86_64-unknown-linux-gnu", BaseDirectory::Resource)
                    .expect("Failed to resolve backend path in dev mode")
            } else {
                // Production: bundled in resource dir (from tauri.conf.json)
                app.path()
                    .resource_dir()
                    .expect("Failed to get resource dir")
                    .join("binaries")
                    .join("backend-x86_64-unknown-linux-gnu")
            };

            println!("Launching backend binary at: {:?}", backend_path);

            Command::new(backend_path)
                .spawn()
                .expect("Failed to start backend process");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

