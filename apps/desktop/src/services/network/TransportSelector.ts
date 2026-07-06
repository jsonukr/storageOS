import type { DeviceEndpoint, ConnectionQuality } from "./types";

const SCORE_REACHABLE = 100;
const SCORE_PRIORITY_WEIGHT = 2;
const SCORE_LATENCY_PENALTY_PER_MS = 0.1;
const SCORE_FAILURE_PENALTY = 15;
const SCORE_FAILURE_PENALTY_MAX = 60;
const SCORE_SUCCESS_RATE_WEIGHT = 30;
const LATENCY_EXCELLENT_MS = 50;
const LATENCY_GOOD_MS = 150;
const LATENCY_FAIR_MS = 500;

export function scoreEndpoint(ep: DeviceEndpoint): number {
  let score = 0;

  if (ep.reachable) {
    score += SCORE_REACHABLE;
  }

  const maxPriority = 50;
  score += (maxPriority - ep.priority) * SCORE_PRIORITY_WEIGHT;

  if (ep.health.latencyMs !== null && ep.health.latencyMs > 0) {
    score -= ep.health.latencyMs * SCORE_LATENCY_PENALTY_PER_MS;
  }

  const failurePenalty = Math.min(
    ep.health.failureCount * SCORE_FAILURE_PENALTY,
    SCORE_FAILURE_PENALTY_MAX,
  );
  score -= failurePenalty;

  const total = ep.health.successCount + ep.health.failureCount;
  if (total > 0) {
    const rate = ep.health.successCount / total;
    score += rate * SCORE_SUCCESS_RATE_WEIGHT;
  }

  return score;
}

export function selectBestEndpoint(endpoints: DeviceEndpoint[]): DeviceEndpoint | null {
  if (endpoints.length === 0) return null;

  const reachable = endpoints.filter((e) => e.reachable);
  const candidates = reachable.length > 0 ? reachable : endpoints;

  let best = candidates[0];
  let bestScore = scoreEndpoint(best);

  for (let i = 1; i < candidates.length; i++) {
    const s = scoreEndpoint(candidates[i]);
    if (s > bestScore) {
      best = candidates[i];
      bestScore = s;
    }
  }

  return best;
}

export function computeQuality(ep: DeviceEndpoint | null): ConnectionQuality {
  if (!ep || !ep.reachable) return "offline";

  const latency = ep.health.latencyMs;
  if (latency === null) return "good";

  if (latency <= LATENCY_EXCELLENT_MS) return "excellent";
  if (latency <= LATENCY_GOOD_MS) return "good";
  if (latency <= LATENCY_FAIR_MS) return "fair";
  return "poor";
}

export function getAvailableTransports(endpoints: DeviceEndpoint[]): DeviceEndpoint[] {
  return endpoints
    .filter((e) => e.reachable)
    .sort((a, b) => scoreEndpoint(b) - scoreEndpoint(a));
}
