import { useState, useEffect, useCallback, useRef } from "react";
import { useAgentStore } from "@/stores/agent";

const AGENT_BASE = "http://127.0.0.1:19742";

interface SessionStatus {
  session_id: string;
  pair_code: string;
  pair_code_formatted: string;
  state: "awaiting_peer" | "peer_connected" | "approved" | "rejected" | "expired";
  expires_in_secs: number;
  peer?: {
    device_id: string;
    display_name: string;
    device_kind: string;
    platform: string;
    version: string;
    fingerprint: string;
  };
}

type Tab = "qr" | "code";
type DialogView = "pairing" | "approval" | "rename" | "done";

export function PairDeviceDialog({ onClose }: { onClose: () => void }) {
  const agentState = useAgentStore((s) => s.state);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("qr");
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [countdown, setCountdown] = useState(300);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<DialogView>("pairing");
  const [pendingRequest, setPendingRequest] = useState<SessionStatus | null>(null);
  const [friendlyName, setFriendlyName] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrKeyRef = useRef(0);

  const createSession = useCallback(async () => {
    try {
      const res = await fetch(`${AGENT_BASE}/pair/session`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to create session");
      const data: SessionStatus = await res.json();
      setSession(data);
      setCountdown(data.expires_in_secs);
      setError(null);
      qrKeyRef.current++;
    } catch {
      setError("Agent is not running. Start the agent to pair devices.");
    }
  }, []);

  useEffect(() => {
    if (agentState === "connected") {
      createSession();
    } else {
      setError("Agent must be connected to pair devices.");
    }
  }, [agentState, createSession]);

  useEffect(() => {
    if (!session || view !== "pairing") return;
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          createSession();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [session, view, createSession]);

  useEffect(() => {
    if (!session || view !== "pairing") return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${AGENT_BASE}/pair/pending`);
        if (!res.ok) return;
        const pending: SessionStatus[] = await res.json();
        if (pending.length > 0) {
          setPendingRequest(pending[0]);
          setFriendlyName(pending[0].peer?.display_name ?? "");
          setView("approval");
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session, view]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleApprove() {
    if (!pendingRequest) return;
    try {
      const res = await fetch(`${AGENT_BASE}/pair/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: pendingRequest.session_id,
          friendly_name: friendlyName.trim() || pendingRequest.peer?.display_name || "",
        }),
      });
      if (!res.ok) throw new Error("Approval failed");
      setView("done");
    } catch {
      setError("Failed to approve pairing.");
    }
  }

  async function handleReject() {
    if (!pendingRequest) return;
    try {
      await fetch(`${AGENT_BASE}/pair/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: pendingRequest.session_id }),
      });
      setPendingRequest(null);
      setView("pairing");
      createSession();
    } catch { /* ignore */ }
  }

  function copyCode() {
    if (!session) return;
    navigator.clipboard.writeText(session.pair_code_formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const peerIcon = (kind: string) => {
    if (kind === "phone" || kind === "android") {
      return (
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <rect x="9" y="3" width="14" height="26" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13 25h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    }
    return (
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <rect x="5" y="4" width="22" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11 26h10M16 22v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-surface-smoke)]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={view === "approval" ? "Pairing request" : view === "done" ? "Pairing complete" : "Pair device"}
    >
      <div className="bg-surface-dialog rounded-[8px] border border-border shadow-[var(--shadow-dialog)] w-[400px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 className="text-[14px] font-semibold text-text-primary">
            {view === "approval" ? "Pairing Request" : view === "done" ? "Paired!" : "Pair Device"}
          </h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-[4px] hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-all duration-[83ms]"
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-5">
          {error ? (
            <div className="py-8 text-center">
              <div className="text-text-tertiary mb-3">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto">
                  <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M16 10v8M16 21v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-[12px] text-text-tertiary">{error}</p>
            </div>
          ) : !session ? (
            <div className="py-8 text-center">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-[12px] text-text-tertiary">Creating pairing session…</p>
            </div>
          ) : view === "done" ? (
            <div className="py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--color-success-bg)] flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-success">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-[14px] font-semibold text-text-primary mb-1">Device paired</p>
              <p className="text-[12px] text-text-tertiary">
                {pendingRequest?.peer?.display_name} is now a trusted device.
              </p>
              <button
                onClick={onClose}
                className="mt-4 h-8 px-5 rounded-[4px] text-[12px] font-medium bg-accent text-white hover:bg-accent-hover transition-all duration-[167ms]"
              >
                Done
              </button>
            </div>
          ) : view === "approval" && pendingRequest?.peer ? (
            <div className="py-2">
              <div className="flex flex-col items-center mb-4">
                <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center text-accent mb-3">
                  {peerIcon(pendingRequest.peer.device_kind)}
                </div>
                <p className="text-[13px] font-semibold text-text-primary">
                  {pendingRequest.peer.display_name}
                </p>
                <p className="text-[11px] text-text-tertiary mt-0.5">
                  {pendingRequest.peer.platform || pendingRequest.peer.device_kind} · v{pendingRequest.peer.version || "?"}
                </p>
              </div>

              <p className="text-[12px] text-text-secondary text-center mb-4">
                This device wants to pair with you. Verify the fingerprint, then approve.
              </p>

              {pendingRequest.peer.fingerprint && (
                <div className="bg-surface-tertiary rounded-[6px] px-3 py-2 mb-4">
                  <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Fingerprint</div>
                  <div className="text-[11px] font-mono text-text-primary break-all leading-relaxed">{pendingRequest.peer.fingerprint}</div>
                </div>
              )}

              <div className="mb-4">
                <label className="text-[11px] text-text-secondary mb-1 block">Name this device</label>
                <input
                  type="text"
                  value={friendlyName}
                  onChange={(e) => setFriendlyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApprove()}
                  autoFocus
                  className="w-full h-8 px-3 rounded-[4px] border border-border bg-surface-input text-[13px] text-text-primary outline-none focus:border-accent focus:shadow-[0_0_0_1px_var(--color-accent)] transition-all duration-[167ms]"
                  placeholder={pendingRequest.peer.display_name}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  className="flex-1 h-8 rounded-[4px] text-[12px] font-medium border border-border bg-surface-card text-text-primary hover:bg-surface-hover transition-all duration-[167ms]"
                >
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  className="flex-1 h-8 rounded-[4px] text-[12px] font-medium bg-accent text-white hover:bg-accent-hover transition-all duration-[167ms]"
                >
                  Approve
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tab bar — Fluent segmented control */}
              <div className="flex gap-0.5 mb-4 bg-surface-tertiary rounded-[4px] p-0.5">
                <button
                  onClick={() => setTab("qr")}
                  className={`flex-1 py-1.5 rounded-[3px] text-[12px] font-medium transition-all duration-[167ms] [transition-timing-function:cubic-bezier(0,0,0,1)] ${
                    tab === "qr"
                      ? "bg-surface-card text-text-primary shadow-[var(--shadow-card)]"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  QR Code
                </button>
                <button
                  onClick={() => setTab("code")}
                  className={`flex-1 py-1.5 rounded-[3px] text-[12px] font-medium transition-all duration-[167ms] [transition-timing-function:cubic-bezier(0,0,0,1)] ${
                    tab === "code"
                      ? "bg-surface-card text-text-primary shadow-[var(--shadow-card)]"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  Pairing Code
                </button>
              </div>

              {tab === "qr" ? (
                <>
                  <p className="text-[12px] text-text-secondary mb-3">
                    Scan this QR code with StorageOS on another device.
                  </p>
                  <div className="flex justify-center mb-3">
                    <div className="bg-white p-3 rounded-[8px]">
                      <img
                        key={qrKeyRef.current}
                        src={`${AGENT_BASE}/pair/qr?t=${qrKeyRef.current}`}
                        alt="Pairing QR Code"
                        width={200}
                        height={200}
                        className="block"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-[11px] text-text-tertiary mb-1">
                    <span>Expires in {formatCountdown(countdown)}</span>
                    <span className="text-text-disabled">·</span>
                    <button onClick={createSession} className="text-accent hover:underline">
                      Refresh
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[12px] text-text-secondary mb-4">
                    Enter this code on the other device. No camera needed.
                  </p>
                  <div className="flex justify-center mb-4">
                    <div
                      onClick={copyCode}
                      className="bg-surface-tertiary rounded-[8px] px-6 py-4 cursor-pointer hover:bg-surface-hover transition-all duration-[167ms] group"
                      title="Click to copy"
                    >
                      <div className="text-[24px] font-mono font-bold tracking-[0.15em] text-text-primary select-all">
                        {session.pair_code_formatted}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-[11px] text-text-tertiary mb-1">
                    <button
                      onClick={copyCode}
                      className="text-accent hover:underline"
                    >
                      {copied ? "Copied!" : "Copy code"}
                    </button>
                    <span className="text-text-disabled">·</span>
                    <span>Expires in {formatCountdown(countdown)}</span>
                    <span className="text-text-disabled">·</span>
                    <button onClick={createSession} className="text-accent hover:underline">
                      Refresh
                    </button>
                  </div>
                </>
              )}

              <p className="text-[10px] text-text-tertiary mt-3 text-center">
                Works across any network — no Wi-Fi restriction.
              </p>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-text-disabled">
                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Waiting for a device to connect…
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
