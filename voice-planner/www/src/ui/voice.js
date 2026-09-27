import { $, show, hide, setStatus } from "./dom.js";
import { listen, stopListening, speak, stopSpeaking } from "../native.js";
import { runCommand } from "../assistant.js";

let state = "idle";
let listening = false;
let onDataChanged = () => {};
let onOpenSettings = () => {};
let onNeedSignIn = () => {};

const STATUS_TEXT = {
  idle: "",
  listening: "듣고 있어요...",
  thinking: "생각하는 중...",
  speaking: "",
  error: "",
};

export function initVoice({ dataChanged, openSettings, needSignIn }) {
  onDataChanged = dataChanged;
  onOpenSettings = openSettings;
  onNeedSignIn = needSignIn;

  $("btnMic").addEventListener("click", onMicTap);

  $("btnToggleText").addEventListener("click", () => {
    const form = $("textCmdForm");
    const isHidden = form.hidden;
    if (isHidden) {
      show(form);
      $("btnToggleText").classList.add("voicebar__kbdbtn--active");
      $("textCmdInput").focus();
    } else {
      hide(form);
      $("btnToggleText").classList.remove("voicebar__kbdbtn--active");
    }
  });

  $("textCmdForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const input = $("textCmdInput");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    await handleCommand(text);
  });
}

async function onMicTap() {
  if (state === "thinking") {
    return;
  }

  if (state === "speaking") {
    await stopSpeaking().catch(() => {});
    setMicState("idle");
    return;
  }

  if (listening) {
    try {
      await stopListening();
    } catch {
      // ignore
    } finally {
      listening = false;
      setMicState("idle");
    }
    return;
  }

  setMicState("listening");
  listening = true;
  hide($("voiceBubble"));

  try {
    const finalText = await listen({
      onPartial: (partial) => {
        setStatus($("voiceStatus"), partial ? `"${partial}"` : STATUS_TEXT.listening);
      },
    });
    listening = false;
    if (!finalText) {
      setMicState("idle");
      return;
    }
    await handleCommand(finalText);
  } catch (err) {
    listening = false;
    showError(err.message || "음성 인식에 실패했어요");
  }
}

async function handleCommand(text) {
  if (state === "thinking" || state === "speaking") return;
  setMicState("thinking");
  showBubble(text, "me");

  try {
    const result = await runCommand(text, {
      onStatus: (msg) => setStatus($("voiceStatus"), msg),
    });
    setMicState("speaking");
    showBubble(result.reply, "assistant");
    setStatus($("voiceStatus"), "");
    await speak(result.reply).catch(() => {});
    if (result.changed && (result.changed.todos || result.changed.events)) {
      onDataChanged();
    }
    setMicState("idle");
  } catch (err) {
    const msg = err && err.message;
    if (msg === "NO_API_KEY") {
      showError("Anthropic API 키가 필요해요");
      onOpenSettings("Anthropic API 키를 설정에서 입력해주세요.");
      return;
    }
    if (msg === "NOT_SIGNED_IN") {
      showError("Google 로그인이 필요해요");
      onNeedSignIn();
      return;
    }
    showError(msg || "명령을 처리하지 못했어요");
  }
}

function showBubble(text, from) {
  const bubble = $("voiceBubble");
  bubble.textContent = text;
  bubble.dataset.from = from;
  show(bubble);
}

function showError(message) {
  setMicState("error");
  setStatus($("voiceStatus"), message);
  setTimeout(() => {
    if (state === "error") setMicState("idle");
  }, 2600);
}

function setMicState(next) {
  state = next;
  const btn = $("btnMic");
  btn.classList.remove("micbtn--listening", "micbtn--thinking", "micbtn--speaking", "micbtn--error");
  if (next !== "idle") btn.classList.add(`micbtn--${next}`);
  if (STATUS_TEXT[next] !== undefined && next !== "error") {
    setStatus($("voiceStatus"), STATUS_TEXT[next]);
  }
}
