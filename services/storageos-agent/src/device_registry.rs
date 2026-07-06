use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointRecord {
    pub transport: String,
    pub host: String,
    pub port: u16,
    pub priority: u8,
    pub reachable: bool,
    pub last_seen: i64,
    pub last_successful: i64,
}

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
    #[serde(default)]
    pub endpoints: Vec<EndpointRecord>,
    #[serde(default)]
    pub preferred_transport: String,
    #[serde(default)]
    pub connection_state: String,
    #[serde(default)]
    pub fingerprint: String,
    #[serde(default)]
    pub last_verified: i64,
    #[serde(default)]
    pub trust_status: String,
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
                public_key    TEXT NOT NULL DEFAULT '',
                preferred_transport TEXT NOT NULL DEFAULT 'lan',
                connection_state    TEXT NOT NULL DEFAULT 'disconnected',
                fingerprint         TEXT NOT NULL DEFAULT '',
                last_verified       INTEGER NOT NULL DEFAULT 0,
                trust_status        TEXT NOT NULL DEFAULT 'pending'
            );

            CREATE TABLE IF NOT EXISTS device_endpoints (
                device_id       TEXT NOT NULL,
                transport       TEXT NOT NULL,
                host            TEXT NOT NULL,
                port            INTEGER NOT NULL DEFAULT 19742,
                priority        INTEGER NOT NULL DEFAULT 10,
                reachable       INTEGER NOT NULL DEFAULT 0,
                last_seen       INTEGER NOT NULL DEFAULT 0,
                last_successful INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (device_id, transport),
                FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
            );",
        )
        .map_err(|e| format!("Failed to create device tables: {e}"))?;

        self.migrate_schema(&conn)
    }

    fn migrate_schema(&self, conn: &Connection) -> Result<(), String> {
        let has_preferred: bool = conn
            .prepare("SELECT 1 FROM pragma_table_info('devices') WHERE name = 'preferred_transport'")
            .and_then(|mut s| s.exists([]))
            .unwrap_or(false);

        if !has_preferred {
            conn.execute_batch(
                "ALTER TABLE devices ADD COLUMN preferred_transport TEXT NOT NULL DEFAULT 'lan';
                 ALTER TABLE devices ADD COLUMN connection_state TEXT NOT NULL DEFAULT 'disconnected';",
            )
            .map_err(|e| format!("Failed to migrate devices table: {e}"))?;
        }

        let has_fingerprint: bool = conn
            .prepare("SELECT 1 FROM pragma_table_info('devices') WHERE name = 'fingerprint'")
            .and_then(|mut s| s.exists([]))
            .unwrap_or(false);

        if !has_fingerprint {
            conn.execute_batch(
                "ALTER TABLE devices ADD COLUMN fingerprint TEXT NOT NULL DEFAULT '';
                 ALTER TABLE devices ADD COLUMN last_verified INTEGER NOT NULL DEFAULT 0;
                 ALTER TABLE devices ADD COLUMN trust_status TEXT NOT NULL DEFAULT 'trusted';",
            )
            .map_err(|e| format!("Failed to migrate devices table for identity: {e}"))?;
        }

        let has_endpoints: bool = conn
            .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='device_endpoints'")
            .and_then(|mut s| s.exists([]))
            .unwrap_or(false);

        if has_endpoints {
            let existing = self.list_devices_inner(conn)?;
            for device in existing {
                if device.endpoints.is_empty() && !device.address.is_empty() {
                    let _ = self.upsert_endpoint_inner(
                        conn,
                        &device.device_id,
                        &EndpointRecord {
                            transport: "lan".to_string(),
                            host: device.address.split(':').next().unwrap_or(&device.address).to_string(),
                            port: device.address.split(':').nth(1).and_then(|p| p.parse().ok()).unwrap_or(
                                storageos_core::config::constants::DEFAULT_AGENT_PORT,
                            ),
                            priority: 10,
                            reachable: device.status == "online",
                            last_seen: device.last_seen,
                            last_successful: if device.status == "online" { device.last_seen } else { 0 },
                        },
                    );
                }
            }
        }

        Ok(())
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
                capabilities, permissions, public_key, preferred_transport, connection_state,
                fingerprint, last_verified, trust_status
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
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
                if device.preferred_transport.is_empty() { "lan" } else { &device.preferred_transport },
                if device.connection_state.is_empty() { "disconnected" } else { &device.connection_state },
                device.fingerprint,
                device.last_verified,
                if device.trust_status.is_empty() { "trusted" } else { &device.trust_status },
            ],
        )
        .map_err(|e| format!("Failed to register device: {e}"))?;

        if !device.address.is_empty() {
            let (host, port) = parse_address(&device.address);
            self.upsert_endpoint_inner(
                &conn,
                &device.device_id,
                &EndpointRecord {
                    transport: "lan".to_string(),
                    host,
                    port,
                    priority: 10,
                    reachable: device.status == "online",
                    last_seen: device.last_seen,
                    last_successful: if device.status == "online" { device.last_seen } else { 0 },
                },
            )?;
        }

        Ok(())
    }

    pub fn upsert_endpoint(
        &self,
        device_id: &str,
        endpoint: &EndpointRecord,
    ) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        self.upsert_endpoint_inner(&conn, device_id, endpoint)
    }

    fn upsert_endpoint_inner(
        &self,
        conn: &Connection,
        device_id: &str,
        endpoint: &EndpointRecord,
    ) -> Result<(), String> {
        conn.execute(
            "INSERT OR REPLACE INTO device_endpoints (
                device_id, transport, host, port, priority, reachable, last_seen, last_successful
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                device_id,
                endpoint.transport,
                endpoint.host,
                endpoint.port,
                endpoint.priority,
                endpoint.reachable as i32,
                endpoint.last_seen,
                endpoint.last_successful,
            ],
        )
        .map_err(|e| format!("Failed to upsert endpoint: {e}"))?;
        Ok(())
    }

    pub fn remove_endpoint(&self, device_id: &str, transport: &str) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let deleted = conn
            .execute(
                "DELETE FROM device_endpoints WHERE device_id = ?1 AND transport = ?2",
                params![device_id, transport],
            )
            .map_err(|e| format!("Failed to remove endpoint: {e}"))?;
        Ok(deleted > 0)
    }

    pub fn list_endpoints(&self, device_id: &str) -> Result<Vec<EndpointRecord>, String> {
        let conn = self.conn.lock().unwrap();
        self.list_endpoints_inner(&conn, device_id)
    }

    fn list_endpoints_inner(
        &self,
        conn: &Connection,
        device_id: &str,
    ) -> Result<Vec<EndpointRecord>, String> {
        let mut stmt = conn
            .prepare(
                "SELECT transport, host, port, priority, reachable, last_seen, last_successful
                 FROM device_endpoints
                 WHERE device_id = ?1
                 ORDER BY priority ASC",
            )
            .map_err(|e| format!("Failed to prepare endpoint query: {e}"))?;

        let endpoints = stmt
            .query_map(params![device_id], |row| {
                Ok(EndpointRecord {
                    transport: row.get(0)?,
                    host: row.get(1)?,
                    port: row.get::<_, i32>(2)? as u16,
                    priority: row.get::<_, i32>(3)? as u8,
                    reachable: row.get::<_, i32>(4)? != 0,
                    last_seen: row.get(5)?,
                    last_successful: row.get(6)?,
                })
            })
            .map_err(|e| format!("Failed to query endpoints: {e}"))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(endpoints)
    }

    pub fn update_endpoint_reachability(
        &self,
        device_id: &str,
        transport: &str,
        reachable: bool,
        last_seen: i64,
    ) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let sql = if reachable {
            "UPDATE device_endpoints SET reachable = 1, last_seen = ?1, last_successful = ?1 WHERE device_id = ?2 AND transport = ?3"
        } else {
            "UPDATE device_endpoints SET reachable = 0, last_seen = ?1 WHERE device_id = ?2 AND transport = ?3"
        };
        let updated = conn
            .execute(sql, params![last_seen, device_id, transport])
            .map_err(|e| format!("Failed to update endpoint reachability: {e}"))?;
        Ok(updated > 0)
    }

    pub fn get_device(&self, device_id: &str) -> Result<Option<DeviceRecord>, String> {
        let conn = self.conn.lock().unwrap();
        let device = conn
            .query_row(
                "SELECT device_id, system_name, friendly_name, device_type, platform,
                        version, address, last_seen, paired_at, status,
                        capabilities, permissions, public_key,
                        fingerprint, last_verified, trust_status
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
                        endpoints: Vec::new(),
                        preferred_transport: String::new(),
                        connection_state: String::new(),
                        fingerprint: row.get::<_, String>(13).unwrap_or_default(),
                        last_verified: row.get::<_, i64>(14).unwrap_or(0),
                        trust_status: row.get::<_, String>(15).unwrap_or_default(),
                    })
                },
            )
            .optional()
            .map_err(|e| format!("Failed to query device: {e}"))?;

        match device {
            Some(mut d) => {
                d.endpoints = self.list_endpoints_inner(&conn, &d.device_id)?;
                d.preferred_transport = self.get_preferred_transport_inner(&conn, &d.device_id)?;
                d.connection_state = self.get_connection_state_inner(&conn, &d.device_id)?;
                Ok(Some(d))
            }
            None => Ok(None),
        }
    }

    fn get_preferred_transport_inner(&self, conn: &Connection, device_id: &str) -> Result<String, String> {
        conn.query_row(
            "SELECT preferred_transport FROM devices WHERE device_id = ?1",
            params![device_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("Failed to query preferred transport: {e}"))
        .map(|v| v.unwrap_or_else(|| "lan".to_string()))
    }

    fn get_connection_state_inner(&self, conn: &Connection, device_id: &str) -> Result<String, String> {
        conn.query_row(
            "SELECT connection_state FROM devices WHERE device_id = ?1",
            params![device_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("Failed to query connection state: {e}"))
        .map(|v| v.unwrap_or_else(|| "disconnected".to_string()))
    }

    pub fn list_devices(&self) -> Result<Vec<DeviceRecord>, String> {
        let conn = self.conn.lock().unwrap();
        self.list_devices_inner(&conn)
    }

    fn list_devices_inner(&self, conn: &Connection) -> Result<Vec<DeviceRecord>, String> {
        let mut stmt = conn
            .prepare(
                "SELECT device_id, system_name, friendly_name, device_type, platform,
                        version, address, last_seen, paired_at, status,
                        capabilities, permissions, public_key,
                        fingerprint, last_verified, trust_status
                 FROM devices ORDER BY paired_at DESC",
            )
            .map_err(|e| format!("Failed to prepare query: {e}"))?;

        let mut devices: Vec<DeviceRecord> = stmt
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
                    endpoints: Vec::new(),
                    preferred_transport: String::new(),
                    connection_state: String::new(),
                    fingerprint: row.get::<_, String>(13).unwrap_or_default(),
                    last_verified: row.get::<_, i64>(14).unwrap_or(0),
                    trust_status: row.get::<_, String>(15).unwrap_or_default(),
                })
            })
            .map_err(|e| format!("Failed to query devices: {e}"))?
            .filter_map(|r| r.ok())
            .collect();

        for device in &mut devices {
            device.endpoints = self.list_endpoints_inner(conn, &device.device_id)?;
            device.preferred_transport = self.get_preferred_transport_inner(conn, &device.device_id)?;
            device.connection_state = self.get_connection_state_inner(conn, &device.device_id)?;
        }

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

        if !address.is_empty() {
            let (host, port) = parse_address(address);
            let _ = self.upsert_endpoint_inner(
                &conn,
                device_id,
                &EndpointRecord {
                    transport: "lan".to_string(),
                    host,
                    port,
                    priority: 10,
                    reachable: status == "online",
                    last_seen,
                    last_successful: if status == "online" { last_seen } else { 0 },
                },
            );
        }

        Ok(updated > 0)
    }

    pub fn remove_device(&self, device_id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM device_endpoints WHERE device_id = ?1",
            params![device_id],
        )
        .map_err(|e| format!("Failed to remove device endpoints: {e}"))?;
        let deleted = conn
            .execute(
                "DELETE FROM devices WHERE device_id = ?1",
                params![device_id],
            )
            .map_err(|e| format!("Failed to remove device: {e}"))?;
        Ok(deleted > 0)
    }
}

fn parse_address(address: &str) -> (String, u16) {
    if let Some(colon) = address.rfind(':') {
        if let Ok(port) = address[colon + 1..].parse::<u16>() {
            return (address[..colon].to_string(), port);
        }
    }
    (
        address.to_string(),
        storageos_core::config::constants::DEFAULT_AGENT_PORT,
    )
}
