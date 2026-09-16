export function zoneView(snapshot, player) {
  const label = player === "p1" ? "1P" : "2P";
  if (snapshot.state === "ready") {
    return { label, stateWord: "준비", detail: "손을 올려두세요", actionLabel: "대결 시작", outcome: "" };
  }
  if (snapshot.state === "waiting") {
    return { label, stateWord: "기다려…", detail: "신호 전에는 누르지 마세요", actionLabel: "", outcome: "" };
  }
  if (snapshot.state === "signal") {
    return { label, stateWord: "지금!", detail: "먼저 누르세요", actionLabel: "", outcome: "" };
  }
  const { result } = snapshot;
  const won = result.winner === player;
  const reaction = result.reactionMs === null ? "" : `${result.reactionMs} ms`;
  return {
    label,
    stateWord: won ? "승리" : result.reason === "false-start" ? "성급한 터치" : "패배",
    detail: won ? reaction || "상대가 먼저 눌렀어요" : `${result.winner === "p1" ? "1P" : "2P"} 승리`,
    actionLabel: "다시 대결",
    outcome: won ? "win" : "loss",
  };
}

export function latestTimeText(snapshot) {
  if (!snapshot.result) return "READY";
  return snapshot.result.reactionMs === null ? "FALSE START" : `${snapshot.result.reactionMs} ms`;
}
