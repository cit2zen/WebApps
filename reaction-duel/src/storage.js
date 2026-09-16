const KEY = "reaction-duel.stats.v1";

function emptyStats() {
  return {
    p1: { wins: 0, bestMs: null },
    p2: { wins: 0, bestMs: null },
    rounds: 0,
    recent: [],
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validPlayer(value) {
  return value === "p1" || value === "p2";
}

function normalize(candidate) {
  if (!candidate || typeof candidate !== "object") return emptyStats();
  const stats = emptyStats();
  ["p1", "p2"].forEach((player) => {
    const value = candidate[player];
    if (!value || !Number.isInteger(value.wins) || value.wins < 0) return;
    stats[player].wins = value.wins;
    stats[player].bestMs = Number.isFinite(value.bestMs) && value.bestMs >= 0 ? value.bestMs : null;
  });
  stats.rounds = Number.isInteger(candidate.rounds) && candidate.rounds >= 0 ? candidate.rounds : 0;
  if (Array.isArray(candidate.recent)) {
    stats.recent = candidate.recent
      .filter((entry) => entry && validPlayer(entry.winner) && ["reaction", "false-start"].includes(entry.reason))
      .slice(0, 5)
      .map((entry) => ({
        winner: entry.winner,
        reason: entry.reason,
        reactionMs: Number.isFinite(entry.reactionMs) && entry.reactionMs >= 0 ? entry.reactionMs : null,
      }));
  }
  return stats;
}

export function createStatsStore(storage) {
  let stats = emptyStats();

  function save() {
    try {
      storage?.setItem(KEY, JSON.stringify(stats));
    } catch {
      // Storage is optional; a game round must never fail because persistence does.
    }
  }

  function load() {
    try {
      stats = normalize(JSON.parse(storage?.getItem(KEY) ?? "null"));
    } catch {
      stats = emptyStats();
    }
    return clone(stats);
  }

  function record(result) {
    if (!result || !validPlayer(result.winner) || !validPlayer(result.loser)) return clone(stats);
    stats.rounds += 1;
    stats[result.winner].wins += 1;
    const reactionMs = Number.isFinite(result.reactionMs) && result.reactionMs >= 0 ? result.reactionMs : null;
    if (reactionMs !== null && (stats[result.winner].bestMs === null || reactionMs < stats[result.winner].bestMs)) {
      stats[result.winner].bestMs = reactionMs;
    }
    stats.recent.unshift({ winner: result.winner, reason: result.reason, reactionMs });
    stats.recent = stats.recent.slice(0, 5);
    save();
    return clone(stats);
  }

  function clear() {
    stats = emptyStats();
    save();
    return clone(stats);
  }

  load();
  return { load, record, clear };
}
