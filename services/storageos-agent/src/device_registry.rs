use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceRecord {
    pub device_id: String,
    pub system_name: String,
    pub friendly_name: String,
    pub device_type: String,
    pub platform: String,
    pub version: String,
    pub address: String,
    pub last_seen: i64,
    pub paired_at: i64,
    pub status: String,
    pub capabilities: String,
    pub permissions: String,
    pub public_key: String,
}

pub struct DeviceRegistry {
    conn: Mutex<Connection>,
}

impl DeviceRegistry {
    pub fn open(path: &Path) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {e}"))?;
        }

        let conn = Connection::open(path)
            .map_err(|e| format!("Failed to open device registry: {e}"))?;

        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA busy_timeout = 5000;
             PRAGMA foreign_keys = ON;",
        )
        .map_err(|e| format!("Failed to set pragmas: {e}"))?;

        let registry = Self {
            conn: Mutex::new(conn),
        };
        registry.init_schema()?;
        Ok(registry)
    }

    fn init_schema(&self) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS agent_identity (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS devices (
                device_id     TEXT PRIMARY KEY,
                system_name   TEXT NOT NULL,
                friendly_name TEXT NOT NULL,
                device_type   TEXT NOT NULL DEFAULT 'desktop',
                platform      TEXT NOT NULL DEFAULT '',
                version       TEXT NOT NULL DEFAULT '',
                address       TEXT NOT NULL DEFAULT '',
                last_seen     INTEGER NOT NULL DEFAULT 0,
                paired_at     INTEGER NOT NULL,
                status        TEXT NOT NULL DEFAULT 'offline',
                capabilities  TEXT NOT NULL DEFAULT '{}',
                permissions   TEXT NOT NULL DEFAULT '{}',
                public_key    TEXT NOT NULL DEFAULT ''
            );",
        )
        .map_err(|e| format!("Failed to create device tables: {e}"))
    }

    pub fn get_identity(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT value FROM agent_identity WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("Failed to query identity: {e}"))
    }

    pub fn set_identity(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO agent_identity (key, value) VALUES (?1, ?2)",
            params![key, value],
        )
        .map_err(|e| format!("Failed to set identity: {e}"))?;
        Ok(())
    }

    pub fn get_or_create_device_id(&self) -> Result<String, String> {
        if let Some(id) = self.get_identity("device_id")? {
            return Ok(id);
        }
        let id = uuid::Uuid::new_v4().to_string();
        self.set_identity("device_id", &id)?;
        Ok(id)
    }

    pub fn register_device(&self, device: &DeviceRecord) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO devices (
                device_id, system_name, friendly_name, device_type, platform,
                version, address, last_seen, paired_at, status,
                capabilities, permissions, public_key
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                device.device_id,
                device.system_name,
                device.friendly_name,
                device.device_type,
                device.platform,
                device.version,
                device.address,
                device.last_seen,
                device.paired_at,
                device.status,
                device.capabilities,
                device.permissions,
                device.public_key,
            ],
        )
        .map_err(|e| format!("Failed to register device: {e}"))?;
        Ok(())
    }

    pub fn get_device(&self, device_id: &str) -> Result<Option<DeviceRecord>, String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT device_id, system_name, friendly_name, device_type, platform,
                    version, address, last_seen, paired_at, status,
                    capabilities, permissions, public_key
             FROM devices WHERE device_id = ?1",
            params![device_id],
            |row| {
                Ok(DeviceRecord {
                    device_id: row.get(0)?,
                    system_name: row.get(1)?,
                    friendly_name: row.get(2)?,
                    device_type: row.get(3)?,
                    platform: row.get(4)?,
                    version: row.get(5)?,
                    address: row.get(6)?,
                    last_seen: row.get(7)?,
                    paired_at: row.get(8)?,
                    status: row.get(9)?,
                    capabilities: row.get(10)?,
                    permissions: row.get(11)?,
                    public_key: row.get(12)?,
                })
            },
        )
        .optional()
        .map_err(|e| format!("Failed to query device: {e}"))
    }

    pub fn list_devices(&self) -> Result<Vec<DeviceRecord>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT device_id, system_name, friendly_name, device_type, platform,
                        version, address, last_seen, paired_at, status,
                        capabilities, permissions, public_key
                 FROM devices ORDER BY paired_at DESC",
            )
            .map_err(|e| format!("Failed to prepare query: {e}"))?;

        let devices = stmt
            .query_map([], |row| {
                Ok(DeviceRecord {
                    device_id: row.get(0)?,
                    system_name: row.get(1)?,
                    friendly_name: row.get(2)?,
                    device_type: row.get(3)?,
                    platform: row.get(4)?,
                    version: row.get(5)?,
                    address: row.get(6)?,
                    last_seen: row.get(7)?,
                    paired_at: row.get(8)?,
                    status: row.get(9)?,
                    capabilities: row.get(10)?,
                    permissions: row.get(11)?,
                    public_key: row.get(12)?,
                })
            })
            .map_err(|e| format!("Failed to query devices: {e}"))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(devices)
    }

    pub fn update_friendly_name(
        &self,
        device_id: &str,
        friendly_name: &str,
    ) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let updated = conn
            .execute(
                "UPDATE devices SET friendly_name = ?1 WHERE device_id = ?2",
                params![friendly_name, device_id],
            )
            .map_err(|e| format!("Failed to update friendly name: {e}"))?;
        Ok(updated > 0)
    }

    pub fn update_device_status(
        &self,
        device_id: &str,
        status: &str,
        address: &str,
        last_seen: i64,
    ) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let updated = conn
            .execute(
                "UPDATE devices SET status = ?1, address = ?2, last_seen = ?3 WHERE device_id = ?4",
                params![status, address, last_seen, device_id],
            )
            .map_err(|e| format!("Failed to update status: {e}"))?;
        Ok(updated > 0)
    }

    pub fn remove_device(&self, device_id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let deleted = conn
            .execute(
                "DELETE FROM devices WHERE device_id = ?1",
                params![device_id],
            )
            .map_err(|e| format!("Failed to remove device: {e}"))?;
        Ok(deleted > 0)
    }
}
