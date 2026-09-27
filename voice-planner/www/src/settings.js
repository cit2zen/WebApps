const DEFAULTS = { anthropicKey: '', googleWebClientId: '200946765758-fp7stf1ksfc2vgsobeueqqmhi5r10efn.apps.googleusercontent.com', reminderMinutes: 10 };
const KEY_PREFIX = 'vp_';

function isNativePlatform() {
  return !!window.Capacitor?.isNativePlatform?.();
}

function getPreferences() {
  return window.Capacitor?.Plugins?.Preferences ?? window.Capacitor?.registerPlugin?.('Preferences');
}

async function readValue(key) {
  if (isNativePlatform()) {
    const { value } = await getPreferences().get({ key: KEY_PREFIX + key });
    return value;
  }
  try {
    return window.localStorage.getItem(KEY_PREFIX + key);
  } catch {
    return null;
  }
}

async function writeValue(key, value) {
  if (isNativePlatform()) {
    await getPreferences().set({ key: KEY_PREFIX + key, value: String(value) });
    return;
  }
  try {
    window.localStorage.setItem(KEY_PREFIX + key, String(value));
  } catch {
    /* private mode or storage disabled */
  }
}

export async function getSettings() {
  const [anthropicKey, googleWebClientId, reminderMinutes] = await Promise.all([
    readValue('anthropicKey'),
    readValue('googleWebClientId'),
    readValue('reminderMinutes'),
  ]);
  return {
    anthropicKey: anthropicKey ?? DEFAULTS.anthropicKey,
    googleWebClientId: googleWebClientId || DEFAULTS.googleWebClientId,
    reminderMinutes: reminderMinutes !== null && reminderMinutes !== undefined ? Number(reminderMinutes) : DEFAULTS.reminderMinutes,
  };
}

export async function saveSettings(partial) {
  const tasks = [];
  if (partial.anthropicKey !== undefined) tasks.push(writeValue('anthropicKey', partial.anthropicKey));
  if (partial.googleWebClientId !== undefined) tasks.push(writeValue('googleWebClientId', partial.googleWebClientId));
  if (partial.reminderMinutes !== undefined) tasks.push(writeValue('reminderMinutes', partial.reminderMinutes));
  await Promise.all(tasks);
}
