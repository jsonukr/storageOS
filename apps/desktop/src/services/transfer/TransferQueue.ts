import type { TransferJob, TransferStatus, TransferType } from "./types";

let nextId = 1;

function generateId(): string {
  return `transfer-${nextId++}-${Date.now()}`;
}

type QueueChangeListener = (jobs: readonly TransferJob[]) => void;

export class TransferQueue {
  private jobs: TransferJob[] = [];
  private listeners: QueueChangeListener[] = [];

  subscribe(listener: QueueChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    const snapshot = this.getJobs();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  enqueue(
    type: TransferType,
    name: string,
    source: string,
    destination: string,
    totalBytes: number,
  ): TransferJob {
    const job: TransferJob = {
      id: generateId(),
      type,
      name,
      source,
      destination,
      status: "queued",
      progress: 0,
      bytesTransferred: 0,
      totalBytes,
      speed: 0,
      startedAt: null,
      completedAt: null,
      error: null,
    };
    this.jobs.push(job);
    this.notify();
    return job;
  }

  dequeue(id: string): boolean {
    const index = this.jobs.findIndex((j) => j.id === id);
    if (index === -1) return false;
    this.jobs.splice(index, 1);
    this.notify();
    return true;
  }

  cancel(id: string): boolean {
    return this.transition(id, "cancelled", ["queued", "preparing", "running", "paused"]);
  }

  pause(id: string): boolean {
    return this.transition(id, "paused", ["running"]);
  }

  resume(id: string): boolean {
    return this.transition(id, "running", ["paused"]);
  }

  clearCompleted(): void {
    this.jobs = this.jobs.filter(
      (j) => j.status !== "completed" && j.status !== "cancelled" && j.status !== "failed",
    );
    this.notify();
  }

  getJobs(): readonly TransferJob[] {
    return [...this.jobs];
  }

  getJob(id: string): TransferJob | undefined {
    return this.jobs.find((j) => j.id === id);
  }

  updateProgress(id: string, bytesTransferred: number, totalBytes: number, speed: number): boolean {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return false;
    if (job.status === "queued") {
      job.status = "running";
      job.startedAt = Date.now();
    } else if (job.status !== "running") {
      return false;
    }
    job.bytesTransferred = bytesTransferred;
    if (totalBytes > 0) job.totalBytes = totalBytes;
    job.speed = speed;
    job.progress = job.totalBytes > 0 ? (bytesTransferred / job.totalBytes) * 100 : 0;
    this.notify();
    return true;
  }

  setStatus(id: string, status: TransferStatus, error?: string): boolean {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return false;
    job.status = status;
    if (status === "running" && job.startedAt === null) {
      job.startedAt = Date.now();
    }
    if (status === "completed" || status === "failed" || status === "cancelled") {
      job.completedAt = Date.now();
      job.speed = 0;
    }
    if (status === "completed") {
      job.progress = 100;
      job.bytesTransferred = job.totalBytes;
    }
    if (status === "failed" && error) {
      job.error = error;
    }
    this.notify();
    return true;
  }

  private transition(id: string, to: TransferStatus, from: TransferStatus[]): boolean {
    const job = this.jobs.find((j) => j.id === id);
    if (!job || !from.includes(job.status)) return false;
    return this.setStatus(id, to);
  }
}
