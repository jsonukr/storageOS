use std::collections::HashMap;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, LazyLock, Mutex};

pub const SIGNAL_RUNNING: u8 = 0;
pub const SIGNAL_PAUSED: u8 = 1;
pub const SIGNAL_CANCEL: u8 = 2;

static CONTROLS: LazyLock<Mutex<HashMap<String, Arc<AtomicU8>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn register(id: &str) -> Arc<AtomicU8> {
    let signal = Arc::new(AtomicU8::new(SIGNAL_RUNNING));
    CONTROLS
        .lock()
        .unwrap()
        .insert(id.to_string(), Arc::clone(&signal));
    signal
}

pub fn unregister(id: &str) {
    CONTROLS.lock().unwrap().remove(id);
}

pub fn set_signal(id: &str, value: u8) -> bool {
    if let Some(signal) = CONTROLS.lock().unwrap().get(id) {
        signal.store(value, Ordering::Relaxed);
        true
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn register_and_signal() {
        let signal = register("test-ctrl-1");
        assert_eq!(signal.load(Ordering::Relaxed), SIGNAL_RUNNING);

        assert!(set_signal("test-ctrl-1", SIGNAL_PAUSED));
        assert_eq!(signal.load(Ordering::Relaxed), SIGNAL_PAUSED);

        assert!(set_signal("test-ctrl-1", SIGNAL_CANCEL));
        assert_eq!(signal.load(Ordering::Relaxed), SIGNAL_CANCEL);

        unregister("test-ctrl-1");
        assert!(!set_signal("test-ctrl-1", SIGNAL_RUNNING));
    }

    #[test]
    fn signal_nonexistent_returns_false() {
        assert!(!set_signal("nonexistent-transfer", SIGNAL_PAUSED));
    }
}
