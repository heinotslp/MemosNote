#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use tauri::api::process::Command;
use tauri::Manager;

fn get_free_port() -> u16 {
  TcpListener::bind("127.0.0.1:0")
    .and_then(|listener| listener.local_addr())
    .map(|addr| addr.port())
    .unwrap_or(8081) // fallback to Memos default dev port
}

fn main() {
  // 1. Get random free port
  let port = get_free_port();

  // 2. Resolve database path (executable root directory)
  let current_exe = std::env::current_exe().expect("failed to get current exe path");
  let exe_dir = current_exe.parent().expect("failed to get parent directory");
  let data_dir = exe_dir.to_string_lossy().to_string();

  // 3. Start memos-backend sidecar
  let (mut rx, child) = Command::new_sidecar("memos-backend")
    .expect("failed to create sidecar command")
    .args(vec![
      "--port".to_string(),
      port.to_string(),
      "--data".to_string(),
      data_dir,
    ])
    .spawn()
    .expect("failed to spawn sidecar process");

  // Share child reference safely to kill it on exit
  let child_arc = Arc::new(Mutex::new(Some(child)));
  let child_for_logging = Arc::clone(&child_arc);

  // Run a background thread to monitor sidecar output (logging)
  tauri::async_runtime::spawn(async move {
    while let Some(event) = rx.recv().await {
      match event {
        tauri::api::process::CommandEvent::Stdout(line) => {
          println!("[backend] {}", line);
        }
        tauri::api::process::CommandEvent::Stderr(line) => {
          eprintln!("[backend err] {}", line);
        }
        _ => {}
      }
    }
  });

  // Construct tauri builder
  let context = tauri::generate_context!();
  let child_for_window_event = Arc::clone(&child_arc);
  
  tauri::Builder::default()
    .setup(move |app| {
      let main_window = app.get_window("main").unwrap();
      
      // Let's format local server URL
      let local_url = format!("http://localhost:{}", port);
      let url = tauri::WindowUrl::App(local_url.parse().unwrap());
      
      // Navigate main window to the resolved local port
      let _ = main_window.navigate(url);
      
      Ok(())
    })
    .on_window_event(move |event| {
      if let tauri::WindowEvent::Destroyed = event.event() {
        if let Ok(mut guard) = child_for_window_event.lock() {
          if let Some(c) = guard.take() {
            let _ = c.kill();
          }
        }
      }
    })
    .run(context)
    .expect("error while running tauri application");
}
