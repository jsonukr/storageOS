import { useTransferStore } from "@/stores/transfer";
import type { TransferJob } from "@/services/transfer";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return "—";
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatRemaining(job: TransferJob): string {
  if (job.status !== "running" || job.speed <= 0) return "—";
  const remaining = job.totalBytes - job.bytesTransferred;
  const seconds = remaining / job.speed;
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.ceil((seconds % 3600) / 60)}m`;
}

function formatElapsed(job: TransferJob): string {
  if (!job.startedAt) return "—";
  const end = job.completedAt ?? Date.now();
  return formatDuration(end - job.startedAt);
}

const STATUS_LABELS: Record<TransferJob["status"], string> = {
  queued: "Queued",
  preparing: "Preparing",
  running: "Running",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
};

const STATUS_COLORS: Record<TransferJob["status"], string> = {
  queued: "text-text-secondary",
  preparing: "text-accent",
  running: "text-accent",
  paused: "text-warning",
  completed: "text-success",
  cancelled: "text-text-tertiary",
  failed: "text-danger",
};

export default function Transfers() {
  const jobs = useTransferStore((s) => s.jobs);
  const cancelJob = useTransferStore((s) => s.cancelJob);
  const pauseJob = useTransferStore((s) => s.pauseJob);
  const resumeJob = useTransferStore((s) => s.resumeJob);
  const removeJob = useTransferStore((s) => s.removeJob);
  const clearCompleted = useTransferStore((s) => s.clearCompleted);

  const active = jobs.filter((j) => j.status === "running" || j.status === "preparing");
  const queued = jobs.filter((j) => j.status === "queued");
  const paused = jobs.filter((j) => j.status === "paused");
  const finished = jobs.filter(
    (j) => j.status === "completed" || j.status === "cancelled" || j.status === "failed",
  );
  const hasFinished = finished.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Transfers</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            {jobs.length} job{jobs.length !== 1 ? "s" : ""} &middot;{" "}
            {active.length} active
          </p>
        </div>
        {hasFinished && (
          <button
            onClick={clearCompleted}
            className="rounded-md border border-border px-3 py-1 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            Clear finished
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {jobs.length === 0 ? (
          <EmptyState />
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-border bg-surface text-left text-text-tertiary">
                <th className="py-2 pl-4 pr-2 font-medium w-[22%]">Name</th>
                <th className="py-2 px-2 font-medium w-[14%]">Source</th>
                <th className="py-2 px-2 font-medium w-[14%]">Destination</th>
                <th className="py-2 px-2 font-medium w-[8%]">Status</th>
                <th className="py-2 px-2 font-medium w-[14%]">Progress</th>
                <th className="py-2 px-2 font-medium w-[8%]">Speed</th>
                <th className="py-2 px-2 font-medium w-[6%]">ETA</th>
                <th className="py-2 px-2 font-medium w-[6%]">Elapsed</th>
                <th className="py-2 pl-2 pr-4 font-medium text-right w-[8%]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {active.length > 0 && (
                <SectionHeader label="Active" count={active.length} />
              )}
              {active.map((job) => (
                <JobRow key={job.id} job={job} onCancel={cancelJob} onPause={pauseJob} onResume={resumeJob} onRemove={removeJob} />
              ))}
              {paused.length > 0 && (
                <SectionHeader label="Paused" count={paused.length} />
              )}
              {paused.map((job) => (
                <JobRow key={job.id} job={job} onCancel={cancelJob} onPause={pauseJob} onResume={resumeJob} onRemove={removeJob} />
              ))}
              {queued.length > 0 && (
                <SectionHeader label="Queued" count={queued.length} />
              )}
              {queued.map((job) => (
                <JobRow key={job.id} job={job} onCancel={cancelJob} onPause={pauseJob} onResume={resumeJob} onRemove={removeJob} />
              ))}
              {finished.length > 0 && (
                <SectionHeader label="Finished" count={finished.length} />
              )}
              {finished.map((job) => (
                <JobRow key={job.id} job={job} onCancel={cancelJob} onPause={pauseJob} onResume={resumeJob} onRemove={removeJob} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <tr>
      <td colSpan={9} className="bg-surface-secondary px-4 py-1.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
        {label} ({count})
      </td>
    </tr>
  );
}

interface JobRowProps {
  job: TransferJob;
  onCancel: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string) => void;
}

function JobRow({ job, onCancel, onPause, onResume, onRemove }: JobRowProps) {
  const isTerminal = job.status === "completed" || job.status === "cancelled" || job.status === "failed";

  return (
    <tr className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
      {/* Name */}
      <td className="py-2 pl-4 pr-2">
        <div className="flex items-center gap-2">
          <TransferTypeIcon type={job.type} />
          <span className="text-text-primary truncate" title={job.name}>{job.name}</span>
        </div>
      </td>

      {/* Source */}
      <td className="py-2 px-2 text-text-secondary truncate" title={job.source}>
        {job.source}
      </td>

      {/* Destination */}
      <td className="py-2 px-2 text-text-secondary truncate" title={job.destination}>
        {job.destination}
      </td>

      {/* Status */}
      <td className="py-2 px-2">
        <span className={`font-medium ${STATUS_COLORS[job.status]}`}>
          {STATUS_LABELS[job.status]}
        </span>
        {job.error && (
          <p className="text-[10px] text-danger truncate mt-0.5" title={job.error}>{job.error}</p>
        )}
      </td>

      {/* Progress */}
      <td className="py-2 px-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                job.status === "failed" ? "bg-danger" :
                job.status === "completed" ? "bg-success" :
                job.status === "paused" ? "bg-warning" :
                "bg-accent"
              }`}
              style={{ width: `${Math.min(job.progress, 100)}%` }}
            />
          </div>
          <span className="text-text-tertiary w-9 text-right shrink-0">
            {formatBytes(job.bytesTransferred)}
          </span>
        </div>
        <p className="text-[10px] text-text-tertiary mt-0.5">
          {Math.round(job.progress)}% of {formatBytes(job.totalBytes)}
        </p>
      </td>

      {/* Speed */}
      <td className="py-2 px-2 text-text-secondary">
        {formatSpeed(job.speed)}
      </td>

      {/* ETA */}
      <td className="py-2 px-2 text-text-secondary">
        {formatRemaining(job)}
      </td>

      {/* Elapsed */}
      <td className="py-2 px-2 text-text-secondary">
        {formatElapsed(job)}
      </td>

      {/* Actions */}
      <td className="py-2 pl-2 pr-4">
        <div className="flex items-center justify-end gap-1">
          {job.status === "running" && (
            <ActionButton label="Pause" onClick={() => onPause(job.id)}>
              <path d="M4 3h2v8H4zM8 3h2v8H8z" fill="currentColor" />
            </ActionButton>
          )}
          {job.status === "paused" && (
            <ActionButton label="Resume" onClick={() => onResume(job.id)}>
              <path d="M4 2.5v9l7-4.5-7-4.5Z" fill="currentColor" />
            </ActionButton>
          )}
          {!isTerminal && (
            <ActionButton label="Cancel" onClick={() => onCancel(job.id)}>
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </ActionButton>
          )}
          {isTerminal && (
            <ActionButton label="Remove" onClick={() => onRemove(job.id)}>
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </ActionButton>
          )}
        </div>
      </td>
    </tr>
  );
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded p-1 text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors"
      aria-label={label}
      title={label}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        {children}
      </svg>
    </button>
  );
}

function TransferTypeIcon({ type }: { type: TransferJob["type"] }) {
  if (type === "move") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-accent shrink-0">
        <path d="M7 2v10M7 2L4 5M7 2l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-accent shrink-0">
      <rect x="2" y="2" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="5" y="5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-16">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-text-tertiary mb-4">
        <path d="M12 22l6-6 6 6M18 16v16M36 26l-6 6-6-6M30 32V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h2 className="text-sm font-medium text-text-secondary">No transfers</h2>
      <p className="text-xs text-text-tertiary mt-1">
        Copy or move files to see transfer progress here
      </p>
    </div>
  );
}
