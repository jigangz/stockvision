use std::sync::Mutex;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Kill the python-backend sidecar. Called before relaunch during updates
/// so the old process doesn't linger.
#[tauri::command]
fn kill_sidecar(state: tauri::State<'_, SidecarChild>) {
    // 1. Kill the managed sidecar child if it exists
    let mut guard = state.0.lock().unwrap();
    if let Some(child) = guard.take() {
        let _ = child.kill();
    }
    drop(guard);

    // 2. Fallback: kill any python-backend process by port 8899
    //    This handles cases where the sidecar was started outside Tauri (dev mode)
    //    or the managed handle lost track of the process.
    #[cfg(target_os = "windows")]
    {
        // Find PID listening on port 8899 and kill it
        let _ = std::process::Command::new("cmd")
            .args(["/C", "for /f \"tokens=5\" %a in ('netstat -ano ^| findstr :8899 ^| findstr LISTENING') do taskkill /F /PID %a"])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("sh")
            .args(["-c", "lsof -ti:8899 | xargs -r kill -9"])
            .output();
    }

    // 3. Brief pause to let the OS reclaim the port
    std::thread::sleep(std::time::Duration::from_millis(500));
}

/// Global handle to the running Python sidecar child process.
/// Stored so we can kill it when the app exits.
struct SidecarChild(Mutex<Option<tauri_plugin_shell::process::CommandChild>>);

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
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
                let state: tauri::State<'_, SidecarChild> = window.state();
                let mut guard = state.0.lock().unwrap();
                if let Some(child) = guard.take() {
                    let _ = child.kill();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![greet, kill_sidecar])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
