import { $, show, hide } from "./dom.js";
import { getSettings, saveSettings } from "../settings.js";
import { initAuth, signIn, signOut, isSignedIn, currentUser } from "../auth.js";
import { requestNotificationPermission } from "../native.js";

let onAfterSave = () => {};

export function initSettingsSheet(afterSaveCb) {
  onAfterSave = afterSaveCb;

  $("btnSettings").addEventListener("click", () => openSheet());
  $("btnOnboardSettings").addEventListener("click", () => openSheet());
  $("sheetBackdrop").addEventListener("click", closeSheet);
  $("btnSettingsCancel").addEventListener("click", closeSheet);

  $("btnSettingsSave").addEventListener("click", async () => {
    try {
      await saveSettings({
        anthropicKey: $("fieldApiKey").value.trim(),
        googleWebClientId: $("fieldGoogleClientId").value.trim(),
        reminderMinutes: Number($("fieldReminderMinutes").value) || 0,
      });
    } catch (err) {
      setMsg(err.message || "설정 저장에 실패했어요.");
      return;
    }
    try {
      await initAuth();
    } catch (err) {
      setMsg(err.message || "인증 초기화에 실패했어요.");
    }
    updateAccountRow();
    closeSheet();
    onAfterSave();
  });

  $("btnGoogleAuth").addEventListener("click", async () => {
    try {
      if (isSignedIn()) {
        await signOut();
      } else {
        await signIn();
      }
      updateAccountRow();
      onAfterSave();
    } catch (err) {
      setMsg(err.message || "인증 작업에 실패했어요.");
    }
  });

  $("btnNotifPermission").addEventListener("click", async () => {
    try {
      const granted = await requestNotificationPermission();
      setMsg(granted ? "알림 권한이 허용됐어요." : "알림 권한이 거부됐어요.");
    } catch (err) {
      setMsg(err.message || "알림 권한 요청에 실패했어요.");
    }
  });
}

export async function openSheet(message) {
  const s = await getSettings();
  $("fieldApiKey").value = s.anthropicKey || "";
  $("fieldGoogleClientId").value = s.googleWebClientId || "";
  $("fieldReminderMinutes").value = s.reminderMinutes ?? 10;
  updateAccountRow();
  setMsg(message);
  show($("sheetBackdrop"));
  show($("settingsSheet"));
}

export function closeSheet() {
  hide($("sheetBackdrop"));
  hide($("settingsSheet"));
}

function updateAccountRow() {
  const user = currentUser();
  const authBtn = $("btnGoogleAuth");
  const text = $("sheetAccountText");
  if (user) {
    text.textContent = user.email;
    authBtn.textContent = "로그아웃";
  } else {
    text.textContent = "로그인되어 있지 않아요";
    authBtn.textContent = "Google 로그인";
  }
}

function setMsg(message) {
  const el = $("settingsMsg");
  if (message) {
    el.textContent = message;
    show(el);
  } else {
    hide(el);
  }
}
