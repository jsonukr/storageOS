export type {
  StorageItemType,
  ContentType,
  StorageItemId,
  StorageItem,
  StorageItemPage,
  ListOptions,
  SearchOptions,
} from "./StorageItem";

export type {
  ProviderType,
  ConnectionState,
  StorageQuota,
  StorageDrive,
} from "./StorageDrive";

export type { StorageCapabilities } from "./StorageCapabilities";

export {
  StorageError,
  type StorageErrorCode,
} from "./StorageErrors";

export type {
  StorageChangeType,
  StorageChangeEvent,
  StorageChangeListener,
  StorageWatcher,
} from "./StorageEvents";

export type {
  OperationType,
  OperationState,
  OperationProgress,
  OperationProgressListener,
  TransferRequest,
  ConflictStrategy,
  UploadRequest,
  DownloadRequest,
  OperationHandle,
} from "./StorageOperation";

export type {
  AuthCredentials,
  AuthResult,
  ProviderInfo,
  StorageProvider,
} from "./StorageProvider";
