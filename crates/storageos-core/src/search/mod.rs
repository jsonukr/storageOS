//! Search — filename search across directories and providers.

mod engine;

pub use engine::search_directory;

use crate::errors::CoreResult;
use crate::models::Entry;

/// Public API surface for search.
///
/// Not yet implemented — this documents the target interface.
pub trait SearchService {
    fn search_directory(
        &self,
        path: &str,
        query: &str,
        recursive: bool,
    ) -> CoreResult<Vec<Entry>>;
}
