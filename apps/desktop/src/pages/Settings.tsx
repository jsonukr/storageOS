import { useAgentStore } from "@/stores/agent";
import type { AgentConnectionState } from "@/services/agent";

export default function Settings() {
  const agentState = useAgentStore((s) => s.state);
  const agentVersion = useAgentStore((s) => s.agentVersion);
  const agentUptime = useAgentStore((s) => s.agentUptime);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[640px] mx-auto py-6 px-6 space-y-6">
        <h1 className="text-lg font-semibold text-text-primary">Settings</h1>

        <SettingsGroup title="Agent">
          <SettingsRow
            label="Status"
            value={<AgentStatusBadge state={agentState} />}
          />
          <SettingsRow
            label="Version"
            value={agentVersion ?? "—"}
          />
          <SettingsRow
            label="Uptime"
            value={agentUptime != null ? formatUptime(agentUptime) : "—"}
          />
          <SettingsRow
            label="Port"
            value="19742"
          />
          <SettingsRow
            label="Bind Address"
            value="0.0.0.0 (LAN)"
          />
        </SettingsGroup>

        <SettingsGroup title="Appearance">
          <SettingsRow
            label="Theme"
            value="System"
            description="Follows your Windows color mode"
          />
        </SettingsGroup>

        <SettingsGroup title="Startup">
          <SettingsRow
            label="Start Agent with Windows"
            value="Manual"
            description="Agent starts when StorageOS opens"
          />
        </SettingsGroup>

        <SettingsGroup title="About">
          <SettingsRow label="StorageOS" value="0.1.0" />
          <SettingsRow label="Tauri" value="2.x" />
          <SettingsRow label="Platform" value="Windows" />
          <SettingsRow
            label="Repository"
            value={
              <span className="text-[12px] text-accent">github.com/StorageOS</span>
            }
          />
        </SettingsGroup>
      </div>
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider mb-2">
        {title}
      </h2>
      <div className="bg-surface-hover rounded-lg border border-border divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({
  label,
  value,
  description,
}: {
  label: string;
  value: React.ReactNode;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <div className="text-[13px] text-text-primary">{label}</div>
        {description && (
          <div className="text-[11px] text-text-tertiary mt-0.5">{description}</div>
        )}
      </div>
      <div className="text-[12px] text-text-secondary shrink-0 ml-4">
        {typeof value === "string" ? value : value}
      </div>
    </div>
  );
}

function AgentStatusBadge({ state }: { state: AgentConnectionState }) {
  const color = state === "connected" ? "bg-success" :
    state === "error" ? "bg-danger" :
    state === "connecting" || state === "starting" ? "bg-warning" :
    "bg-text-tertiary";

  const label = state === "connected" ? "Connected" :
    state === "connecting" ? "Connecting" :
    state === "starting" ? "Starting" :
    state === "error" ? "Error" :
    "Offline";

  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      <span>{label}</span>
    </span>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
