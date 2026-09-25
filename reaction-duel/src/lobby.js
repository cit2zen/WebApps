// 로비 표시 전용(Polaroid) — 게임 로직은 browser.js 그대로. 시작은 기존 .round-action 클릭 훅을 재사용한다.
(() => {
  const lobby = document.getElementById("lobby");
  const startButton = document.getElementById("lobby-start");
  const seamLobby = document.getElementById("seam-lobby");
  if (!lobby || !startButton) return;

  startButton.addEventListener("click", () => {
    lobby.hidden = true;
    const hook = document.querySelector(".player-zone[data-player='p2'] .round-action");
    if (hook) hook.click();
  });

  if (seamLobby) {
    seamLobby.addEventListener("click", () => {
      const phase = document.getElementById("game").dataset.state;
      if (phase === "waiting" || phase === "signal") return;
      lobby.hidden = false;
      startButton.focus();
    });
  }
})();
