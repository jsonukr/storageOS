# StorageOS

One Workspace, Every Storage.

StorageOS is a distributed personal storage platform that provides secure, real-time access to every authorized storage location from every authorized device.

## Project Structure

```
storageos/
├── docs/                  # Documentation
│   ├── vision/
│   ├── prd/
│   ├── architecture/
│   ├── api/
│   ├── database/
│   └── ui/
│
├── apps/                  # Client applications
│   ├── desktop/
│   ├── web/
│   └── mobile/
│
├── services/              # Backend services
│   ├── backend/
│   ├── auth/
│   ├── search/
│   ├── sync/
│   └── notifications/
│
├── agent/                 # AI agent
│
├── connectors/            # Storage provider connectors
│   ├── local/
│   ├── google-drive/
│   ├── onedrive/
│   ├── sharepoint/
│   └── ...
│
├── shared/                # Shared libraries and utilities
│
├── infrastructure/        # Infrastructure and deployment configs
│
└── README.md
```
