function P(name) {
  return window.Capacitor?.Plugins?.[name] ?? window.Capacitor?.registerPlugin?.(name);
}

export function isNative() {
  return !!window.Capacitor?.isNativePlatform?.();
}

let webRecognition = null;
let webRecognitionActive = false;

function listenWeb(onPartial) {
  const SpeechCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechCtor) return Promise.reject(new Error('음성 인식을 지원하지 않습니다'));

  return new Promise((resolve, reject) => {
    const rec = new SpeechCtor();
    webRecognition = rec;
    rec.lang = 'ko-KR';
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += text;
        else interim += text;
      }
      onPartial?.(finalText + interim);
    };
    rec.onerror = (event) => {
      webRecognitionActive = false;
      if (event.error === 'no-speech' || event.error === 'aborted') resolve(finalText);
      else reject(new Error(event.error || '음성 인식 오류'));
    };
    rec.onend = () => {
      webRecognitionActive = false;
      resolve(finalText);
    };

    webRecognitionActive = true;
    rec.start();
  });
}

async function listenNative(onPartial) {
  const SpeechRecognition = P('SpeechRecognition');
  const { available } = await SpeechRecognition.available();
  if (!available) throw new Error('음성 인식을 지원하지 않습니다');

  const perm = await SpeechRecognition.checkPermissions();
  if (perm.speechRecognition !== 'granted') {
    const req = await SpeechRecognition.requestPermissions();
    if (req.speechRecognition !== 'granted') throw new Error('음성 인식 권한이 필요합니다');
  }

  let lastPartial = '';
  const listeners = [];
  const cleanup = () => listeners.forEach((h) => h.remove());
  const result = await new Promise((resolve) => {
    let settled = false;
    const finish = (text) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(text);
    };

    let stoppedAt = 0;
    let graceTimer = null;
    const safetyTimer = setTimeout(() => {
      SpeechRecognition.stop().catch(() => {});
      finish(lastPartial);
    }, 8000);

    SpeechRecognition.addListener('partialResults', (data) => {
      const text = data?.matches?.[0];
      if (text) {
        lastPartial = text;
        onPartial?.(text);
      }
      if (stoppedAt) {
        clearTimeout(graceTimer);
        clearTimeout(safetyTimer);
        finish(lastPartial);
      }
    }).then((h) => listeners.push(h));

    SpeechRecognition.addListener('listeningState', (data) => {
      if (data?.status === 'stopped' && !stoppedAt) {
        stoppedAt = Date.now();
        graceTimer = setTimeout(() => {
          clearTimeout(safetyTimer);
          finish(lastPartial);
        }, 700);
      }
    }).then((h) => listeners.push(h));

    SpeechRecognition.start({
      language: 'ko-KR',
      partialResults: true,
      popup: false,
    }).catch(() => {
      clearTimeout(safetyTimer);
      finish(lastPartial);
    });
  });

  return result;
}

export function listen({ onPartial } = {}) {
  if (isNative()) return listenNative(onPartial);
  return listenWeb(onPartial);
}

export async function stopListening() {
  if (isNative()) {
    P('SpeechRecognition').stop().catch(() => {});
    return;
  }
  if (webRecognitionActive && webRecognition) webRecognition.stop();
}

export async function speak(text) {
  if (isNative()) {
    await P('TextToSpeech').speak({ text, lang: 'ko-KR', rate: 1.0, pitch: 1.0, volume: 1.0 });
    return;
  }
  if (!window.speechSynthesis) return;
  await new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ko-KR';
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.speak(utter);
  });
}

export async function stopSpeaking() {
  if (isNative()) return void (await P('TextToSpeech').stop());
  window.speechSynthesis?.cancel();
}

export async function requestNotificationPermission() {
  if (!isNative()) {
    if (!window.Notification) return false;
    if (Notification.permission === 'granted') return true;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  const LocalNotifications = P('LocalNotifications');
  const status = await LocalNotifications.checkPermissions();
  if (status.display === 'granted') return true;
  const req = await LocalNotifications.requestPermissions();
  return req.display === 'granted';
}

const webTimers = new Map();
let notificationPermissionRequested = false;

export async function scheduleReminders(items) {
  const now = Date.now();
  const future = items.filter((it) => it.at.getTime() > now);

  if (!isNative()) {
    for (const timer of webTimers.values()) clearTimeout(timer);
    webTimers.clear();
    for (const item of future) {
      const timer = setTimeout(() => {
        if (window.Notification && Notification.permission === 'granted') new Notification(item.title, { body: item.body });
      }, item.at.getTime() - now);
      webTimers.set(item.id, timer);
    }
    return;
  }

  if (!notificationPermissionRequested) {
    notificationPermissionRequested = true;
    await requestNotificationPermission();
  }
  const LocalNotifications = P('LocalNotifications');
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
  if (!future.length) return;
  await LocalNotifications.schedule({
    notifications: future.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      schedule: { at: item.at },
      isExactNotification: false,
    })),
  });
}
