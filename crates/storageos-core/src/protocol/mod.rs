pub mod envelope;
pub mod pairing;
pub mod payloads;

pub use envelope::{Message, MessageId, MessageKind, ProtocolVersion};
pub use payloads::*;

pub const CURRENT_VERSION: ProtocolVersion = ProtocolVersion { major: 1, minor: 0 };
