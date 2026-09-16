import { RoundController } from "./game.js";
import { createStatsStore } from "./storage.js";
import { latestTimeText, zoneView } from "./view-model.js";

const game = new RoundController();
const stats = createStatsStore(window.localStorage);
const gameElement = document.querySelector("#game");
const zones = [...document.querySelectorAll(".player-zone")];
const roundCount = document.querySelector("#round-count");
const latestTime = document.querySelector("#latest-time");
const p1Best = document.querySelector("#p1-best");
const p2Best = document.querySelector("#p2-best");
const recentResults = document.querySelector("#recent-results");
let recordedRound = 0;

function displayTime(value) { return value === null ? "—" : `${value} ms`; }
function renderStats(data) {
  p1Best.textContent = `1P ${displayTime(data.p1.bestMs)}`;
  p2Best.textContent = `2P ${displayTime(data.p2.bestMs)}`;
  recentResults.replaceChildren(...data.recent.map((entry) => {
    const item = document.createElement("li");
    item.textContent = `${entry.winner.toUpperCase()} ${entry.reason === "false-start" ? "성급한 터치" : displayTime(entry.reactionMs)}`;
    return item;
  }));
}
function render(snapshot) {
  gameElement.dataset.state = snapshot.state;
  roundCount.textContent = `ROUND ${snapshot.round}`;
  latestTime.textContent = latestTimeText(snapshot);
  zones.forEach((zone) => {
    const view = zoneView(snapshot, zone.dataset.player);
    zone.dataset.outcome = view.outcome;
    zone.querySelector(".player-label").textContent = `${view.label} · ${view.label === "1P" ? "W" : "↓"}`;
    zone.querySelector(".state-word").textContent = view.stateWord;
    zone.querySelector(".result-detail").textContent = view.detail;
    const action = zone.querySelector(".round-action");
    action.textContent = view.actionLabel;
    action.hidden = !view.actionLabel;
  });
  if (snapshot.state === "result" && recordedRound !== snapshot.round) {
    recordedRound = snapshot.round;
    renderStats(stats.record(snapshot.result));
  }
}
zones.forEach((zone) => {
  zone.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".round-action")) return;
    game.press(zone.dataset.player);
  });
  zone.querySelector(".round-action").addEventListener("click", (event) => {
    event.stopPropagation();
    game.start();
  });
});
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "w") game.press("p1");
  if (event.key === "ArrowDown") { event.preventDefault(); game.press("p2"); }
});
renderStats(stats.load());
game.onChange(render);
