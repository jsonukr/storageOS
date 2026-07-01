//! StorageOS Core — shared business logic for all StorageOS clients.
//!
//! This crate contains all reusable, transport-independent logic.
//! The Agent binary, desktop app, CLI, and future mobile clients
//! all depend on this crate. No Tauri, no Axum, no HTTP — just
//! pure domain logic.

pub mod clipboard;
pub mod config;
pub mod errors;
pub mod events;
pub mod filesystem;
pub mod models;
pub mod platform;
pub mod providers;
pub mod search;
pub mod transfer;
pub mod utils;
