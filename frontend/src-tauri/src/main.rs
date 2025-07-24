// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
// MODIFIED: Import ShellExt and the correct CommandEvent enum
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                // Get a handle to the main window
                let window = app.get_webview_window("main").unwrap();
                // Use the unified open_devtools() method, which works on all platforms
                // window.open_devtools();
            }

            // --- Start the backend sidecar ---
            // MODIFIED: Get a handle to the app that can be moved into the async task
            let app_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                // MODIFIED: Use the app_handle to get the shell scope inside the task
                let shell = app_handle.shell();
                let backend_command = tauri::path::BaseDirectory::Resource;
                let backend_path = app_handle.path()
                    .resolve("binaries/backend", backend_command)
                    .expect("failed to resolve backend path");

                // MODIFIED: Unwrap the Result from .sidecar() before chaining methods
                let (mut rx, _child) = shell
                    .sidecar("backend")
                    .expect("failed to create sidecar command")
                    .args([backend_path.to_string_lossy().as_ref()])
                    .spawn()
                    .expect("Failed to spawn backend sidecar");

                while let Some(event) = rx.recv().await {
                    // MODIFIED: Use the correct enum 'CommandEvent' for Stderr
                    if let CommandEvent::Stderr(line) = event {
                        // MODIFIED: Convert the Vec<u8> to a string before printing
                        println!("Backend stderr: {}", String::from_utf8_lossy(&line));
                    }
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
