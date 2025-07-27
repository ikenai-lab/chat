// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri::{Manager, WindowEvent};
use tauri_plugin_shell::{process::{CommandEvent, CommandChild}, ShellExt};
use std::sync::{Arc, Mutex};

// A struct to hold the sidecar process Child
struct AppState {
    child_process: Arc<Mutex<Option<CommandChild>>>,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        // Initialize the managed state with an empty process
        .manage(AppState { 
            child_process: Arc::new(Mutex::new(None)) 
        })
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                // window.open_devtools();
            }

            let app_handle = app.handle().clone();
            
            // Get a clone of the Arc to move into the async block
            let child_process = app.state::<AppState>().child_process.clone();

            tauri::async_runtime::spawn(async move {
                let shell = app_handle.shell();
                let backend_command = tauri::path::BaseDirectory::Resource;
                let backend_path = app_handle.path()
                    .resolve("binaries/backend", backend_command)
                    .expect("failed to resolve backend path");

                let (mut rx, child) = shell
                    .sidecar("backend")
                    .expect("failed to create sidecar command")
                    .args([backend_path.to_string_lossy().as_ref()])
                    .spawn()
                    .expect("Failed to spawn backend sidecar");

                // Store the child process in the managed state
                *child_process.lock().unwrap() = Some(child);

                while let Some(event) = rx.recv().await {
                    if let CommandEvent::Stderr(line) = event {
                        println!("Backend stderr: {}", String::from_utf8_lossy(&line));
                    }
                }
            });

            Ok(())
        })
        // Add a handler for window events
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                // When the window is closed, get the state and kill the process
                let child_process = window.state::<AppState>().child_process.clone();
                let mut child_guard = child_process.lock().unwrap();
                if let Some(child) = child_guard.take() {
                    println!("Closing backend process with PID: {}", child.pid());
                    // Drop the guard before calling kill to avoid holding the lock
                    drop(child_guard);
                    if let Err(e) = child.kill() {
                        eprintln!("Failed to kill backend process: {}", e);
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}