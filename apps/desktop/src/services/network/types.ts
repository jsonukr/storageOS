export type TransportKind = "lan" | "relay" | "usb" | "bluetooth" | "vpn";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "failed";

export type ConnectionQuality = "excellent" | "good" | "fair" | "poor" | "offline";

export interface EndpointHealth {
  latencyMs: number | null;
  failureCount: number;
  lastFailure: number | null;
  successCount: number;
  lastSuccess: number | null;
}

export interface DeviceEndpoint {
  deviceId: string;
  transport: TransportKind;
  host: string;
  port: number;
  priority: number;
  reachable: boolean;
  lastSeen: number | null;
  lastSuccessful: number | null;
  health: EndpointHealth;
}

export interface ConnectionInfo {
  deviceId: string;
  endpoints: DeviceEndpoint[];
  activeTransport: TransportKind;
  state: ConnectionState;
  connectedAt: number | null;
}

export const TRANSPORT_PRIORITY: Record<TransportKind, number> = {
  lan: 10,
  usb: 20,
  vpn: 30,
  bluetooth: 40,
  relay: 50,
};

export const TRANSPORT_LABELS: Record<TransportKind, string> = {
  lan: "LAN",
  relay: "Relay",
  usb: "USB",
  bluetooth: "Bluetooth",
  vpn: "VPN",
};
