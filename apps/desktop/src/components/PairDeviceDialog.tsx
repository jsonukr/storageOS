import { useState, useEffect, useCallback } from "react";
import { useAgentStore } from "@/stores/agent";

interface PairInfo {
  device_id: string;
  host: string;
  port: number;
  name: string;
  pairing_token: string;
  version: string;
}

export function PairDeviceDialog({ onClose }: { onClose: () => void }) {
  const [pairInfo, setPairInfo] = useState<PairInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const agentState = useAgentStore((s) => s.state);

  const fetchPairInfo = useCallback(async () => {
    try {
      const response = await fetch("http://127.0.0.1:19742/pair");
      if (!response.ok) throw new Error("Failed to fetch pairing info");
      const data: PairInfo = await response.json();
      setPairInfo(data);
      setError(null);
    } catch {
      setError("Agent is not running. Start the agent to pair devices.");
    }
  }, []);

  useEffect(() => {
    if (agentState === "connected") {
      fetchPairInfo();
    } else {
      setError("Agent must be connected to pair devices.");
    }
  }, [agentState, fetchPairInfo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface rounded-lg border border-border shadow-xl w-[380px] overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 className="text-sm font-semibold text-text-primary">Pair Mobile Device</h2>
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
          {error ? (
            <div className="py-8 text-center">
              <div className="text-text-tertiary mb-2">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto">
                  <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M16 10v8M16 21v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-xs text-text-tertiary">{error}</p>
            </div>
          ) : !pairInfo ? (
            <div className="py-8 text-center">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-text-tertiary">Loading pairing info...</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-text-secondary mb-4">
                Scan this QR code with the StorageOS Android app to connect.
              </p>

              <div className="flex justify-center mb-4">
                <div className="bg-white p-3 rounded-lg">
                  <img
                    src="http://127.0.0.1:19742/pair/qr"
                    alt="Pairing QR Code"
                    width={200}
                    height={200}
                    className="block"
                  />
                </div>
              </div>

              <div className="bg-surface-hover rounded-md px-3 py-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-tertiary">Device</span>
                  <span className="text-[11px] text-text-primary font-medium">{pairInfo.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-tertiary">Address</span>
                  <span className="text-[11px] text-text-primary font-mono">{pairInfo.host}:{pairInfo.port}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-tertiary">Version</span>
                  <span className="text-[11px] text-text-primary">{pairInfo.version}</span>
                </div>
              </div>

              <p className="text-[10px] text-text-tertiary mt-3 text-center">
                Both devices must be on the same Wi-Fi network.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
