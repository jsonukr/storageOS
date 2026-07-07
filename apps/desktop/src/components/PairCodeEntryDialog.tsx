import { useState, useEffect, useRef } from "react";

const AGENT_BASE = "http://127.0.0.1:19742";

interface PairCodeEntryDialogProps {
  onClose: () => void;
  onPaired: () => void;
}

type EntryView = "input" | "connecting" | "done" | "error";

export function PairCodeEntryDialog({ onClose, onPaired }: PairCodeEntryDialogProps) {
  const [segments, setSegments] = useState(["", "", ""]);
  const [view, setView] = useState<EntryView>("input");
  const [error, setError] = useState("");
  const [pairedName, setPairedName] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleSegmentChange(index: number, value: string) {
    const cleaned = value.toUpperCase().replace(/[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]/g, "").slice(0, 4);
    const next = [...segments];
    next[index] = cleaned;
    setSegments(next);

    if (cleaned.length === 4 && index < 2) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && segments[index] === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      handleSubmit();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").toUpperCase().replace(/[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]/g, "");
    if (pasted.length >= 12) {
      setSegments([pasted.slice(0, 4), pasted.slice(4, 8), pasted.slice(8, 12)]);
      inputRefs.current[2]?.focus();
    }
  }

  const fullCode = segments.join("");
  const isValid = fullCode.length === 12;

  async function handleSubmit() {
    if (!isValid) return;
    setView("connecting");
    setError("");

    try {
      const res = await fetch(`${AGENT_BASE}/pair/connect-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pair_code: segments.join("-") }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Invalid or expired code" }));
        throw new Error(data.message || "Invalid or expired code");
      }

      const result = await res.json();
      setPairedName(result.remote_name || "Device");
      setView("done");
      onPaired();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setView("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface rounded-lg border border-border shadow-xl w-[380px] overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 className="text-sm font-semibold text-text-primary">Enter Pairing Code</h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-5">
          {view === "done" ? (
            <div className="py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-success">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-sm font-medium text-text-primary mb-1">Connected!</p>
              <p className="text-xs text-text-tertiary">Waiting for {pairedName} to approve the pairing.</p>
              <button
                onClick={onClose}
                className="mt-4 h-8 px-5 rounded-md text-[12px] font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
              >
                Done
              </button>
            </div>
          ) : view === "connecting" ? (
            <div className="py-8 text-center">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-text-tertiary">Connecting to device...</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-text-secondary mb-4">
                Enter the 12-character code shown on the other device.
              </p>

              {view === "error" && (
                <div className="bg-danger/10 text-danger text-[11px] rounded-md px-3 py-2 mb-3">
                  {error}
                </div>
              )}

              <div className="flex justify-center gap-2 mb-4" onPaste={handlePaste}>
                {segments.map((seg, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      value={seg}
                      onChange={(e) => handleSegmentChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      maxLength={4}
                      className="w-[80px] h-10 text-center font-mono text-base font-bold tracking-widest rounded-md border border-border bg-surface text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 uppercase"
                      placeholder="····"
                    />
                    {i < 2 && <span className="text-text-tertiary font-bold">-</span>}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 h-8 rounded-md text-[12px] font-medium border border-border text-text-secondary hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!isValid}
                  className="flex-1 h-8 rounded-md text-[12px] font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  Connect
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
