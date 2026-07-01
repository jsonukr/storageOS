use std::path::PathBuf;
use std::sync::mpsc;
use tray_icon::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tray_icon::{Icon, TrayIconBuilder};

pub enum TrayCommand {
    Exit,
    ViewLogs,
    RestartAgent,
}

pub fn spawn(log_dir: PathBuf) -> mpsc::Receiver<TrayCommand> {
    let (tx, rx) = mpsc::channel();

    std::thread::spawn(move || {
        let menu = Menu::new();

        let status_item = MenuItem::new("StorageOS Agent v0.1.0", false, None);
        let separator1 = PredefinedMenuItem::separator();
        let logs_item = MenuItem::new("View Logs", true, None);
        let restart_item = MenuItem::new("Restart Agent", true, None);
        let separator2 = PredefinedMenuItem::separator();
        let exit_item = MenuItem::new("Exit", true, None);

        let logs_id = logs_item.id().clone();
        let restart_id = restart_item.id().clone();
        let exit_id = exit_item.id().clone();

        let _ = menu.append(&status_item);
        let _ = menu.append(&separator1);
        let _ = menu.append(&logs_item);
        let _ = menu.append(&restart_item);
        let _ = menu.append(&separator2);
        let _ = menu.append(&exit_item);

        let icon = create_icon();

        let _tray = TrayIconBuilder::new()
            .with_menu(Box::new(menu))
            .with_icon(icon)
            .with_tooltip("StorageOS Agent")
            .build()
            .expect("Failed to create tray icon");

        tracing::info!("System tray icon created");

        let menu_rx = MenuEvent::receiver();

        loop {
            #[cfg(windows)]
            pump_messages();

            if let Ok(event) = menu_rx.try_recv() {
                if event.id == exit_id {
                    tracing::info!("Exit requested from tray menu");
                    let _ = tx.send(TrayCommand::Exit);
                    break;
                } else if event.id == logs_id {
                    let _ = tx.send(TrayCommand::ViewLogs);
                    open_directory(&log_dir);
                } else if event.id == restart_id {
                    tracing::info!("Restart requested from tray menu");
                    let _ = tx.send(TrayCommand::RestartAgent);
                    break;
                }
            }

            std::thread::sleep(std::time::Duration::from_millis(50));
        }
    });

    rx
}

fn create_icon() -> Icon {
    let size = 32u32;
    let mut rgba = Vec::with_capacity((size * size * 4) as usize);
    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - 15.5;
            let dy = y as f32 - 15.5;
            let dist = (dx * dx + dy * dy).sqrt();
            if dist < 13.0 {
                rgba.extend_from_slice(&[0x00, 0x78, 0xD4, 0xFF]);
            } else if dist < 14.5 {
                let alpha = ((14.5 - dist) / 1.5 * 255.0) as u8;
                rgba.extend_from_slice(&[0x00, 0x78, 0xD4, alpha]);
            } else {
                rgba.extend_from_slice(&[0, 0, 0, 0]);
            }
        }
    }
    Icon::from_rgba(rgba, size, size).expect("Failed to create tray icon image")
}

#[cfg(windows)]
fn pump_messages() {
    unsafe {
        let mut msg: windows_sys::Win32::UI::WindowsAndMessaging::MSG = std::mem::zeroed();
        while windows_sys::Win32::UI::WindowsAndMessaging::PeekMessageW(
            &mut msg,
            std::ptr::null_mut(),
            0,
            0,
            windows_sys::Win32::UI::WindowsAndMessaging::PM_REMOVE,
        ) != 0
        {
            windows_sys::Win32::UI::WindowsAndMessaging::TranslateMessage(&msg);
            windows_sys::Win32::UI::WindowsAndMessaging::DispatchMessageW(&msg);
        }
    }
}

fn open_directory(path: &std::path::Path) {
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("explorer.exe")
            .arg(path)
            .spawn();
    }
    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(path)
            .spawn();
    }
}
