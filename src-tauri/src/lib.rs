use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Global handle to the running Python sidecar child process.
/// Stored so we can kill it when the app exits.
struct SidecarChild(Mutex<Option<tauri_plugin_shell::process::CommandChild>>);

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarChild(Mutex::new(None)))
        .setup(|app| {
            // Spawn the Python backend sidecar on startup.
            // The binary name "python-backend" maps to
            //   src-tauri/binaries/python-backend-<target-triple>.exe (Windows)
            // via the externalBin config in tauri.conf.json.
            match app.shell().sidecar("python-backend") {
                Ok(cmd) => {
                    match cmd.spawn() {
                        Ok((_rx, child)) => {
                            // Store the child so we can kill it on exit.
                            *app.state::<SidecarChild>().0.lock().unwrap() = Some(child);
                        }
                        Err(e) => {
                            // In development mode the sidecar binary does not exist —
                            // that is expected. Log and continue; the dev server is used
                            // instead.
                            eprintln!("[sidecar] Failed to spawn python-backend: {e}");
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[sidecar] Sidecar not found: {e}");
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Kill the sidecar when the main window closes.
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<SidecarChild>();
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(child) = guard.take() {
                        let _ = child.kill();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
