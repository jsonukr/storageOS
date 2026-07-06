export { ConnectionManager } from "./ConnectionManager";
export {
  selectBestEndpoint,
  scoreEndpoint,
  computeQuality,
  getAvailableTransports,
} from "./TransportSelector";
export { remoteFetch, buildRemoteUrl, recordTransferResult } from "./remoteFetch";
export type {
  TransportKind,
  ConnectionState,
  ConnectionQuality,
  DeviceEndpoint,
  ConnectionInfo,
  EndpointHealth,
} from "./types";
export { TRANSPORT_PRIORITY, TRANSPORT_LABELS } from "./types";
