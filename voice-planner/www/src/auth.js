import { getSettings } from './settings.js';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
  'email',
  'profile',
];

const REFRESH_MS = 50 * 60 * 1000;
const GIS_SRC = 'https://accounts.google.com/gsi/client';

function P(name) {
  return window.Capacitor?.Plugins?.[name] ?? window.Capacitor?.registerPlugin?.(name);
}

function isNativePlatform() {
  return !!window.Capacitor?.isNativePlatform?.();
}

function getPreferences() {
  return window.Capacitor?.Plugins?.Preferences ?? window.Capacitor?.registerPlugin?.('Preferences');
}

let currentUserInfo = null;
let accessToken = null;
let tokenFetchedAt = 0;
let webTokenClient = null;
let webClientIdLoaded = null;
let initialized = false;

function loadGisScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google 인증 스크립트를 불러오지 못했습니다'));
    document.head.appendChild(script);
  });
}

async function ensureWebTokenClient(clientId) {
  await loadGisScript();
  if (webTokenClient && webClientIdLoaded === clientId) return webTokenClient;
  webTokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES.join(' '),
    callback: () => {},
  });
  webClientIdLoaded = clientId;
  return webTokenClient;
}

async function fetchWebProfile(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('사용자 정보를 가져오지 못했습니다');
  const data = await res.json();
  return { email: data.email || '', name: data.name || data.email || '' };
}

export async function initAuth() {
  const settings = await getSettings();
  if (isNativePlatform()) {
    await P('SocialLogin').initialize({ google: { webClientId: settings.googleWebClientId } });
    try {
      const { isLoggedIn } = await P('SocialLogin').isLoggedIn({ provider: 'google' });
      if (isLoggedIn) {
        const prefs = getPreferences();
        const { value } = await prefs.get({ key: 'vp_lastUser' });
        if (value) currentUserInfo = JSON.parse(value);
      }
    } catch {
      /* no previous session */
    }
  }
  initialized = true;
}

async function signInNative() {
  const { result } = await P('SocialLogin').login({
    provider: 'google',
    options: { scopes: SCOPES },
  });
  if (!result.accessToken?.token) throw new Error('Google 액세스 토큰을 받지 못했습니다');
  accessToken = result.accessToken.token;
  tokenFetchedAt = Date.now();
  currentUserInfo = {
    email: result.profile.email || '',
    name: result.profile.name || result.profile.email || '',
  };
  await getPreferences().set({ key: 'vp_lastUser', value: JSON.stringify(currentUserInfo) });
  return currentUserInfo;
}

async function requestWebToken(prompt) {
  const settings = await getSettings();
  const client = await ensureWebTokenClient(settings.googleWebClientId);
  const token = await new Promise((resolve, reject) => {
    client.callback = (resp) => {
      if (resp.error) reject(new Error(resp.error));
      else resolve(resp);
    };
    client.requestAccessToken({ prompt });
  });
  accessToken = token.access_token;
  tokenFetchedAt = Date.now();
}

async function signInWeb() {
  await requestWebToken('consent');
  currentUserInfo = await fetchWebProfile(accessToken);
  return currentUserInfo;
}

export async function signIn() {
  if (!initialized) await initAuth();
  return isNativePlatform() ? signInNative() : signInWeb();
}

export async function signOut() {
  if (isNativePlatform()) {
    try {
      await P('SocialLogin').logout({ provider: 'google' });
    } catch {
      /* already logged out */
    }
    await getPreferences().remove({ key: 'vp_lastUser' });
  } else if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
  currentUserInfo = null;
  accessToken = null;
  tokenFetchedAt = 0;
}

export function isSignedIn() {
  return !!currentUserInfo;
}

export function currentUser() {
  return currentUserInfo;
}

async function refreshNative() {
  const { result } = await P('SocialLogin').login({
    provider: 'google',
    options: { scopes: SCOPES, filterByAuthorizedAccounts: true, autoSelectEnabled: true },
  });
  if (!result.accessToken?.token) throw new Error('Google 액세스 토큰을 받지 못했습니다');
  accessToken = result.accessToken.token;
  tokenFetchedAt = Date.now();
}

let inflight = null;

export async function getAccessToken({ force = false } = {}) {
  if (!currentUserInfo) throw new Error('NOT_SIGNED_IN');
  const stale = force || !accessToken || Date.now() - tokenFetchedAt > REFRESH_MS;
  if (!stale) return accessToken;

  if (!inflight) {
    inflight = (isNativePlatform() ? refreshNative() : requestWebToken('')).finally(() => {
      inflight = null;
    });
  }
  await inflight;
  return accessToken;
}
