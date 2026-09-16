(() => {
  const zones = [...document.querySelectorAll(".player-zone")];
  const state = { phase: "ready", round: 0, timer: null, signalAt: 0, result: null };
  const key = "reaction-duel.stats.v1";
  let stats;

  const emptyStats = () => ({ p1: { wins: 0, bestMs: null }, p2: { wins: 0, bestMs: null }, rounds: 0, recent: [] });
  try { stats = JSON.parse(localStorage.getItem(key)) || emptyStats(); } catch { stats = emptyStats(); }
  if (!stats.p1 || !stats.p2 || !Array.isArray(stats.recent)) stats = emptyStats();

  const playerName = (player) => player === "p1" ? "1P" : "2P";
  const other = (player) => player === "p1" ? "p2" : "p1";
  const displayTime = (value) => value === null ? "—" : `${value} ms`;
  const setText = (selector, value) => document.querySelector(selector).textContent = value;

  function save() {
    try { localStorage.setItem(key, JSON.stringify(stats)); } catch { /* storage is optional */ }
  }

  function renderStats() {
    setText("#p1-best", `1P ${displayTime(stats.p1.bestMs)}`);
    setText("#p2-best", `2P ${displayTime(stats.p2.bestMs)}`);
    const list = document.querySelector("#recent-results");
    list.replaceChildren(...stats.recent.map((entry) => {
      const item = document.createElement("li");
      item.textContent = `${playerName(entry.winner)} ${entry.reason === "false-start" ? "성급한 터치" : displayTime(entry.reactionMs)}`;
      return item;
    }));
  }

  function viewFor(player) {
    if (state.phase === "ready") return { word: "준비", detail: "손을 올려두세요", action: "대결 시작", outcome: "" };
    if (state.phase === "waiting") return { word: "기다려…", detail: "신호 전에는 누르지 마세요", action: "", outcome: "" };
    if (state.phase === "signal") return { word: "지금!", detail: "먼저 누르세요", action: "", outcome: "" };
    const won = state.result.winner === player;
    return {
      word: won ? "승리" : state.result.reason === "false-start" ? "성급한 터치" : "패배",
      detail: won ? (state.result.reactionMs === null ? "상대가 먼저 눌렀어요" : displayTime(state.result.reactionMs)) : `${playerName(state.result.winner)} 승리`,
      action: "다시 대결",
      outcome: won ? "win" : "loss",
    };
  }

  function render() {
    document.querySelector("#game").dataset.state = state.phase;
    setText("#round-count", `ROUND ${state.round}`);
    setText("#latest-time", state.result ? (state.result.reactionMs === null ? "FALSE START" : displayTime(state.result.reactionMs)) : "READY");
    zones.forEach((zone) => {
      const view = viewFor(zone.dataset.player);
      zone.dataset.outcome = view.outcome;
      zone.querySelector(".state-word").textContent = view.word;
      zone.querySelector(".result-detail").textContent = view.detail;
      const button = zone.querySelector(".round-action");
      button.textContent = view.action;
      button.hidden = !view.action;
    });
  }

  function record(result) {
    stats.rounds += 1;
    stats[result.winner].wins += 1;
    if (result.reactionMs !== null && (stats[result.winner].bestMs === null || result.reactionMs < stats[result.winner].bestMs)) stats[result.winner].bestMs = result.reactionMs;
    stats.recent.unshift(result);
    stats.recent = stats.recent.slice(0, 5);
    save();
    renderStats();
  }

  function resolve(player, reason) {
    if (state.phase === "result" || state.phase === "ready") return;
    clearTimeout(state.timer);
    const winner = reason === "false-start" ? other(player) : player;
    state.phase = "result";
    state.result = { winner, loser: other(winner), reason, reactionMs: reason === "reaction" ? Math.max(0, Math.round(performance.now() - state.signalAt)) : null };
    record(state.result);
    render();
  }

  function start() {
    if (state.phase === "waiting" || state.phase === "signal") return;
    clearTimeout(state.timer);
    state.round += 1;
    state.phase = "waiting";
    state.result = null;
    render();
    state.timer = setTimeout(() => {
      if (state.phase !== "waiting") return;
      state.phase = "signal";
      state.signalAt = performance.now();
      render();
    }, 1500 + Math.floor(Math.random() * 2501));
  }

  zones.forEach((zone) => {
    zone.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".round-action")) resolve(zone.dataset.player, state.phase === "waiting" ? "false-start" : "reaction");
    });
    zone.querySelector(".round-action").addEventListener("click", (event) => { event.stopPropagation(); start(); });
  });
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "w") resolve("p1", state.phase === "waiting" ? "false-start" : "reaction");
    if (event.key === "ArrowDown") { event.preventDefault(); resolve("p2", state.phase === "waiting" ? "false-start" : "reaction"); }
  });
  renderStats();
  render();
})();
