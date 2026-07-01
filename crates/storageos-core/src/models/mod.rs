//! Canonical domain models for StorageOS.
//!
//! These are the shared types used across all StorageOS components:
//! storageos-core, storageos-agent, storageos-sdk, desktop, mobile, CLI.
//!
//! Terminology follows `docs/architecture/DomainModel.md`.

pub mod clipboard;
pub mod common;
pub mod device;
pub mod entry;
pub mod notification;
pub mod permission;
pub mod provider;
pub mod root;
pub mod session;
pub mod transfer;

pub use clipboard::*;
pub use common::*;
pub use device::*;
pub use entry::*;
pub use notification::*;
pub use permission::*;
pub use provider::*;
pub use root::*;
pub use session::*;
pub use transfer::*;
