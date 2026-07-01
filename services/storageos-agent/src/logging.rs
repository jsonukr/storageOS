use std::path::Path;
use tracing_appender::rolling;
use tracing_subscriber::fmt::time::UtcTime;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{EnvFilter, Layer};

pub fn init(level: &str, log_dir: &Path) {
    std::fs::create_dir_all(log_dir).ok();

    let filter = EnvFilter::try_new(level).unwrap_or_else(|_| EnvFilter::new("info"));

    let stderr_layer = tracing_subscriber::fmt::layer()
        .with_target(true)
        .with_timer(UtcTime::rfc_3339())
        .with_filter(filter);

    let file_appender = rolling::daily(log_dir, "agent.log");
    let file_filter = EnvFilter::try_new(level).unwrap_or_else(|_| EnvFilter::new("info"));
    let file_layer = tracing_subscriber::fmt::layer()
        .json()
        .with_timer(UtcTime::rfc_3339())
        .with_writer(file_appender)
        .with_filter(file_filter);

    tracing_subscriber::registry()
        .with(stderr_layer)
        .with(file_layer)
        .init();
}
