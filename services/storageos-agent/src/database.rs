use rusqlite::Connection;
use std::path::Path;

const SCHEMA_VERSION: u32 = 1;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create database directory: {e}"))?;
        }

        let conn = Connection::open(path)
            .map_err(|e| format!("Failed to open database at {}: {e}", path.display()))?;

        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA busy_timeout = 5000;
             PRAGMA foreign_keys = ON;",
        )
        .map_err(|e| format!("Failed to set database pragmas: {e}"))?;

        let db = Self { conn };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<(), String> {
        self.conn
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS schema_version (
                    version  INTEGER NOT NULL,
                    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
                );",
            )
            .map_err(|e| format!("Failed to create schema_version table: {e}"))?;

        let current: Option<u32> = self
            .conn
            .query_row(
                "SELECT MAX(version) FROM schema_version",
                [],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to query schema version: {e}"))?;

        if current.unwrap_or(0) < SCHEMA_VERSION {
            self.conn
                .execute(
                    "INSERT INTO schema_version (version) VALUES (?1)",
                    [SCHEMA_VERSION],
                )
                .map_err(|e| format!("Failed to record schema version: {e}"))?;
        }

        Ok(())
    }

    pub fn schema_version(&self) -> Result<u32, String> {
        self.conn
            .query_row(
                "SELECT MAX(version) FROM schema_version",
                [],
                |row| row.get::<_, Option<u32>>(0),
            )
            .map_err(|e| format!("Failed to query schema version: {e}"))
            .map(|v| v.unwrap_or(0))
    }

    pub fn close(self) -> Result<(), String> {
        self.conn
            .execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
            .map_err(|e| format!("WAL checkpoint failed: {e}"))?;
        self.conn
            .close()
            .map_err(|(_, e)| format!("Failed to close database: {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_and_query_schema_version() {
        let dir = std::env::temp_dir().join("storageos-agent-test-db");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("test.db");

        let db = Database::open(&path).unwrap();
        assert_eq!(db.schema_version().unwrap(), SCHEMA_VERSION);
        db.close().unwrap();

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn idempotent_schema_init() {
        let dir = std::env::temp_dir().join("storageos-agent-test-idempotent");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("test.db");

        let db1 = Database::open(&path).unwrap();
        db1.close().unwrap();

        let db2 = Database::open(&path).unwrap();
        assert_eq!(db2.schema_version().unwrap(), SCHEMA_VERSION);
        db2.close().unwrap();

        std::fs::remove_dir_all(&dir).ok();
    }
}
