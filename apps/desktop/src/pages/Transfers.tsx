import { useState } from "react";
import { useTransferStore } from "@/stores/transfer";
import type { TransferJob } from "@/services/transfer";
import type { FolderTransfer } from "@/services/transfer";

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

function formatFolderElapsed(ft: FolderTransfer): string {
  if (!ft.startedAt) return "—";
  const end = ft.completedAt ?? Date.now();
  return formatDuration(end - ft.startedAt);
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

function computeFolderProgress(
  ft: FolderTransfer,
  jobs: readonly TransferJob[],
): { bytesTransferred: number; speed: number; progress: number; eta: string } {
  let bytesTransferred = 0;
  let speed = 0;

  for (const jobId of ft.childJobIds) {
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      bytesTransferred += job.bytesTransferred;
      if (job.status === "running") speed = job.speed;
    }
  }

  const progress =
    ft.totalBytes > 0 ? (bytesTransferred / ft.totalBytes) * 100 : 0;
  const remaining = ft.totalBytes - bytesTransferred;
  const etaSeconds = speed > 0 ? remaining / speed : 0;

  let eta = "—";
  if (speed > 0 && ft.status === "running") {
    if (etaSeconds < 60) eta = `${Math.ceil(etaSeconds)}s`;
    else if (etaSeconds < 3600) eta = `${Math.ceil(etaSeconds / 60)}m`;
    else
      eta = `${Math.floor(etaSeconds / 3600)}h ${Math.ceil((etaSeconds % 3600) / 60)}m`;
  }

  return { bytesTransferred, speed, progress, eta };
}

export default function Transfers() {
  const jobs = useTransferStore((s) => s.jobs);
  const folderTransfers = useTransferStore((s) => s.folderTransfers);
  const cancelJob = useTransferStore((s) => s.cancelJob);
  const pauseJob = useTransferStore((s) => s.pauseJob);
  const resumeJob = useTransferStore((s) => s.resumeJob);
  const removeJob = useTransferStore((s) => s.removeJob);
  const retryJob = useTransferStore((s) => s.retryJob);
  const cancelFolderTransfer = useTransferStore((s) => s.cancelFolderTransfer);
  const removeFolderTransfer = useTransferStore((s) => s.removeFolderTransfer);
  const clearCompleted = useTransferStore((s) => s.clearCompleted);
  const isChildJob = useTransferStore((s) => s.isChildJob);

  const standaloneJobs = jobs.filter((j) => !isChildJob(j.id));

  const activeJobs = standaloneJobs.filter(
    (j) => j.status === "running" || j.status === "preparing",
  );
  const queuedJobs = standaloneJobs.filter((j) => j.status === "queued");
  const pausedJobs = standaloneJobs.filter((j) => j.status === "paused");
  const finishedJobs = standaloneJobs.filter(
    (j) =>
      j.status === "completed" ||
      j.status === "cancelled" ||
      j.status === "failed",
  );

  const activeFolders = folderTransfers.filter(
    (f) => f.status === "running" || f.status === "preparing",
  );
  const finishedFolders = folderTransfers.filter(
    (f) =>
      f.status === "completed" ||
      f.status === "cancelled" ||
      f.status === "failed",
  );

  const totalActive = activeJobs.length + activeFolders.length;
  const totalItems =
    standaloneJobs.length + folderTransfers.length;
  const hasFinished = finishedJobs.length > 0 || finishedFolders.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-text-primary">
            Transfers
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            {totalItems} job{totalItems !== 1 ? "s" : ""} &middot;{" "}
            {totalActive} active
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

      <div className="flex-1 overflow-auto">
        {totalItems === 0 ? (
          <EmptyState />
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-border bg-surface-secondary text-left text-text-tertiary">
                <th className="py-2 pl-4 pr-2 font-medium w-[22%]">Name</th>
                <th className="py-2 px-2 font-medium w-[14%]">Source</th>
                <th className="py-2 px-2 font-medium w-[14%]">Destination</th>
                <th className="py-2 px-2 font-medium w-[8%]">Status</th>
                <th className="py-2 px-2 font-medium w-[14%]">Progress</th>
                <th className="py-2 px-2 font-medium w-[8%]">Speed</th>
                <th className="py-2 px-2 font-medium w-[6%]">ETA</th>
                <th className="py-2 px-2 font-medium w-[6%]">Elapsed</th>
                <th className="py-2 pl-2 pr-4 font-medium text-right w-[8%]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {(activeFolders.length > 0 || activeJobs.length > 0) && (
                <SectionHeader
                  label="Active"
                  count={activeFolders.length + activeJobs.length}
                />
              )}
              {activeFolders.map((ft) => (
                <FolderRow
                  key={ft.id}
                  ft={ft}
                  jobs={jobs}
                  onCancel={cancelFolderTransfer}
                  onRemove={removeFolderTransfer}
                />
              ))}
              {activeJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onCancel={cancelJob}
                  onPause={pauseJob}
                  onResume={resumeJob}
                  onRemove={removeJob}
                  onRetry={retryJob}
                />
              ))}

              {pausedJobs.length > 0 && (
                <SectionHeader label="Paused" count={pausedJobs.length} />
              )}
              {pausedJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onCancel={cancelJob}
                  onPause={pauseJob}
                  onResume={resumeJob}
                  onRemove={removeJob}
                  onRetry={retryJob}
                />
              ))}

              {queuedJobs.length > 0 && (
                <SectionHeader label="Queued" count={queuedJobs.length} />
              )}
              {queuedJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onCancel={cancelJob}
                  onPause={pauseJob}
                  onResume={resumeJob}
                  onRemove={removeJob}
                  onRetry={retryJob}
                />
              ))}

              {(finishedFolders.length > 0 || finishedJobs.length > 0) && (
                <SectionHeader
                  label="Finished"
                  count={finishedFolders.length + finishedJobs.length}
                />
              )}
              {finishedFolders.map((ft) => (
                <FolderRow
                  key={ft.id}
                  ft={ft}
                  jobs={jobs}
                  onCancel={cancelFolderTransfer}
                  onRemove={removeFolderTransfer}
                />
              ))}
              {finishedJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onCancel={cancelJob}
                  onPause={pauseJob}
                  onResume={resumeJob}
                  onRemove={removeJob}
                  onRetry={retryJob}
                />
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
      <td
        colSpan={9}
        className="bg-surface-secondary px-4 py-1.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider"
      >
        {label} ({count})
      </td>
    </tr>
  );
}

interface FolderRowProps {
  ft: FolderTransfer;
  jobs: readonly TransferJob[];
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
}

function FolderRow({ ft, jobs, onCancel, onRemove }: FolderRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isTerminal =
    ft.status === "completed" ||
    ft.status === "cancelled" ||
    ft.status === "failed";

  const { bytesTransferred, speed, progress, eta } = computeFolderProgress(
    ft,
    jobs,
  );

  const childJobs = ft.childJobIds
    .map((id) => jobs.find((j) => j.id === id))
    .filter(Boolean) as TransferJob[];

  const statusDetail =
    ft.status === "preparing"
      ? "Scanning…"
      : ft.status === "running"
        ? `${ft.completedFiles}/${ft.totalFiles} files`
        : ft.failedFiles > 0
          ? `${ft.completedFiles} done, ${ft.failedFiles} failed`
          : `${ft.completedFiles} files`;

  return (
    <>
      <tr className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
        <td className="py-2 pl-4 pr-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-text-tertiary hover:text-text-primary transition-colors shrink-0"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className={`transition-transform ${expanded ? "rotate-90" : ""}`}
              >
                <path
                  d="M5 3l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <FolderIcon />
            <span className="text-text-primary truncate" title={ft.name}>
              {ft.name}
            </span>
          </div>
        </td>

        <td
          className="py-2 px-2 text-text-secondary truncate"
          title={ft.source}
        >
          {ft.source}
        </td>

        <td
          className="py-2 px-2 text-text-secondary truncate"
          title={ft.destination}
        >
          {ft.destination}
        </td>

        <td className="py-2 px-2">
          <span className={`font-medium ${STATUS_COLORS[ft.status]}`}>
            {STATUS_LABELS[ft.status]}
          </span>
          <p className="text-[10px] text-text-tertiary mt-0.5">{statusDetail}</p>
          {ft.error && (
            <p
              className="text-[10px] text-danger truncate mt-0.5"
              title={ft.error}
            >
              {ft.error}
            </p>
          )}
        </td>

        <td className="py-2 px-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  ft.status === "failed"
                    ? "bg-danger"
                    : ft.status === "completed"
                      ? "bg-success"
                      : ft.status === "cancelled"
                        ? "bg-text-tertiary"
                        : "bg-accent"
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <span className="text-text-tertiary w-9 text-right shrink-0">
              {formatBytes(bytesTransferred)}
            </span>
          </div>
          <p className="text-[10px] text-text-tertiary mt-0.5">
            {Math.round(progress)}% of {formatBytes(ft.totalBytes)}
          </p>
        </td>

        <td className="py-2 px-2 text-text-secondary">
          {formatSpeed(speed)}
        </td>

        <td className="py-2 px-2 text-text-secondary">{eta}</td>

        <td className="py-2 px-2 text-text-secondary">
          {formatFolderElapsed(ft)}
        </td>

        <td className="py-2 pl-2 pr-4">
          <div className="flex items-center justify-end gap-1">
            {!isTerminal && (
              <ActionButton
                label="Cancel"
                onClick={() => onCancel(ft.id)}
              >
                <path
                  d="M3 3l8 8M11 3l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </ActionButton>
            )}
            {isTerminal && (
              <ActionButton
                label="Remove"
                onClick={() => onRemove(ft.id)}
              >
                <path
                  d="M3 3l8 8M11 3l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </ActionButton>
            )}
          </div>
        </td>
      </tr>

      {expanded &&
        childJobs.map((job) => (
          <tr
            key={job.id}
            className="border-b border-border/30 bg-surface-secondary/50"
          >
            <td className="py-1.5 pl-12 pr-2">
              <div className="flex items-center gap-2">
                <TransferTypeIcon type={job.type} />
                <span
                  className="text-text-secondary truncate text-[11px]"
                  title={job.name}
                >
                  {job.name}
                </span>
              </div>
            </td>

            <td className="py-1.5 px-2 text-text-tertiary truncate text-[11px]">
              {job.source}
            </td>

            <td className="py-1.5 px-2 text-text-tertiary truncate text-[11px]">
              {job.destination}
            </td>

            <td className="py-1.5 px-2">
              <span
                className={`text-[11px] font-medium ${STATUS_COLORS[job.status]}`}
              >
                {STATUS_LABELS[job.status]}
              </span>
            </td>

            <td className="py-1.5 px-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      job.status === "failed"
                        ? "bg-danger"
                        : job.status === "completed"
                          ? "bg-success"
                          : "bg-accent"
                    }`}
                    style={{ width: `${Math.min(job.progress, 100)}%` }}
                  />
                </div>
              </div>
            </td>

            <td className="py-1.5 px-2 text-text-tertiary text-[11px]">
              {formatSpeed(job.speed)}
            </td>

            <td className="py-1.5 px-2 text-text-tertiary text-[11px]">
              {formatRemaining(job)}
            </td>

            <td className="py-1.5 px-2 text-text-tertiary text-[11px]">
              {formatElapsed(job)}
            </td>

            <td className="py-1.5 pl-2 pr-4" />
          </tr>
        ))}
    </>
  );
}

interface JobRowProps {
  job: TransferJob;
  onCancel: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

function JobRow({
  job,
  onCancel,
  onPause,
  onResume,
  onRemove,
  onRetry,
}: JobRowProps) {
  const isTerminal =
    job.status === "completed" ||
    job.status === "cancelled" ||
    job.status === "failed";

  return (
    <tr className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
      <td className="py-2 pl-4 pr-2">
        <div className="flex items-center gap-2">
          <TransferTypeIcon type={job.type} />
          <span className="text-text-primary truncate" title={job.name}>
            {job.name}
          </span>
        </div>
      </td>

      <td
        className="py-2 px-2 text-text-secondary truncate"
        title={job.source}
      >
        {job.source}
      </td>

      <td
        className="py-2 px-2 text-text-secondary truncate"
        title={job.destination}
      >
        {job.destination}
      </td>

      <td className="py-2 px-2">
        <span className={`font-medium ${STATUS_COLORS[job.status]}`}>
          {STATUS_LABELS[job.status]}
        </span>
        {job.error && (
          <p
            className="text-[10px] text-danger truncate mt-0.5"
            title={job.error}
          >
            {job.error}
          </p>
        )}
      </td>

      <td className="py-2 px-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                job.status === "failed"
                  ? "bg-danger"
                  : job.status === "completed"
                    ? "bg-success"
                    : job.status === "paused"
                      ? "bg-warning"
                      : "bg-accent"
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

      <td className="py-2 px-2 text-text-secondary">
        {formatSpeed(job.speed)}
      </td>

      <td className="py-2 px-2 text-text-secondary">
        {formatRemaining(job)}
      </td>

      <td className="py-2 px-2 text-text-secondary">
        {formatElapsed(job)}
      </td>

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
              <path
                d="M3 3l8 8M11 3l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </ActionButton>
          )}
          {job.status === "failed" && (
            <ActionButton label="Retry" onClick={() => onRetry(job.id)}>
              <path
                d="M11.5 7A4.5 4.5 0 112.5 7M2.5 3v4h4"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </ActionButton>
          )}
          {isTerminal && (
            <ActionButton label="Remove" onClick={() => onRemove(job.id)}>
              <path
                d="M3 3l8 8M11 3l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
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
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="text-accent shrink-0"
      >
        <path
          d="M7 2v10M7 2L4 5M7 2l3 3"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="text-accent shrink-0"
    >
      <rect
        x="2"
        y="2"
        width="7"
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <rect
        x="5"
        y="5"
        width="7"
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="text-accent shrink-0"
    >
      <path
        d="M2 3.5A1.5 1.5 0 013.5 2H5l1.5 1.5h4A1.5 1.5 0 0112 5v5.5A1.5 1.5 0 0110.5 12h-7A1.5 1.5 0 012 10.5V3.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-subtle mb-3">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          className="text-accent"
        >
          <path
            d="M6 11l3-3 3 3M9 8v8M18 13l-3 3-3-3M15 16V8"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="text-[13px] font-semibold text-text-primary mb-1">No transfers</h2>
      <p className="text-[12px] text-text-secondary leading-relaxed">
        Copy or move files to see transfer progress here.
      </p>
    </div>
  );
}
