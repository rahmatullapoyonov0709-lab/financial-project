const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const REFRESH_PATH = '/auth/refresh';
const TX_CHANGED_EVENT = 'fintrack:transactions-changed';
const TX_CHANGED_KEY = 'fintrack:transactions:last-change';
const NOTIFICATION_CHANGED_EVENT = 'fintrack:notifications-changed';
const NOTIFICATION_CHANGED_KEY = 'fintrack:notifications:last-change';

const safeStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key) || sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value, remember = true) {
    try {
      const target = remember ? localStorage : sessionStorage;
      const fallback = remember ? sessionStorage : localStorage;
      fallback.removeItem(key);
      target.setItem(key, value);
    } catch {
      // ignore storage errors
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  },
};

const clearAuthStorage = () => {
  safeStorage.removeItem('token');
  safeStorage.removeItem('refreshToken');
  safeStorage.removeItem('user');
};

const getAuthToken = () => safeStorage.getItem('token');
const getRefreshToken = () => safeStorage.getItem('refreshToken');
const shouldRememberSession = () => {
  try {
    return Boolean(localStorage.getItem('refreshToken'));
  } catch {
    return true;
  }
};

const storeAuthSession = ({ accessToken, refreshToken, user }, { remember = true } = {}) => {
  safeStorage.setItem('token', accessToken, remember);
  safeStorage.setItem('refreshToken', refreshToken, remember);
  safeStorage.setItem('user', JSON.stringify(user), remember);
};

const shouldBroadcastTransactionChange = (method, path) => {
  if (method === 'GET') return false;
  if (!path) return false;
  return path === '/transactions' || path.startsWith('/transactions?') || path.startsWith('/transactions/');
};

const shouldBroadcastNotificationChange = (method, path) => {
  if (method === 'GET') return false;
  if (!path) return false;
  return path === '/notifications' || path.startsWith('/notifications?') || path.startsWith('/notifications/');
};

const broadcastTransactionChange = () => {
  const timestamp = String(Date.now());
  try {
    localStorage.setItem(TX_CHANGED_KEY, timestamp);
  } catch {
    // ignore storage write issues (private mode, quota, etc.)
  }

  try {
    window.dispatchEvent(new CustomEvent(TX_CHANGED_EVENT, { detail: { timestamp } }));
  } catch {
    // ignore event dispatch issues in non-browser contexts
  }
};

const broadcastNotificationChange = () => {
  const timestamp = String(Date.now());
  try {
    localStorage.setItem(NOTIFICATION_CHANGED_KEY, timestamp);
  } catch {
    // ignore storage write issues
  }

  try {
    window.dispatchEvent(new CustomEvent(NOTIFICATION_CHANGED_EVENT, { detail: { timestamp } }));
  } catch {
    // ignore event dispatch issues in non-browser contexts
  }
};

const parseResponse = async (res) => {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return { error: "Serverdan noto'g'ri javob qaytdi" };
};

const rawRequest = async ({ method, path, body, token }) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(BASE + path, {
      method,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });

    const data = await parseResponse(res);
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error("So'rov vaqti tugadi, qayta urinib koring");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

let refreshPromise = null;

const refreshAccessToken = async () => {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  refreshPromise = (async () => {
    const res = await rawRequest({
      method: 'POST',
      path: REFRESH_PATH,
      body: { refreshToken },
      token: null,
    });

    if (!res.ok) {
      clearAuthStorage();
      return false;
    }

    const remember = shouldRememberSession();
    safeStorage.setItem('token', res.data.data.accessToken, remember);
    safeStorage.setItem('refreshToken', res.data.data.refreshToken, remember);
    return true;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

async function request(method, path, body, options = {}) {
  const token = getAuthToken();
  const res = await rawRequest({ method, path, body, token });

  if (res.ok) {
    if (shouldBroadcastTransactionChange(method, path)) {
      broadcastTransactionChange();
    }
    if (shouldBroadcastNotificationChange(method, path)) {
      broadcastNotificationChange();
    }
    return res.data;
  }

  const canRetry = !options.skipRetry && res.status === 401 && path !== REFRESH_PATH;
  if (canRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryRes = await rawRequest({
        method,
        path,
        body,
        token: getAuthToken(),
      });
      if (retryRes.ok) {
        if (shouldBroadcastTransactionChange(method, path)) {
          broadcastTransactionChange();
        }
        if (shouldBroadcastNotificationChange(method, path)) {
          broadcastNotificationChange();
        }
        return retryRes.data;
      }
      if (retryRes.status === 401) {
        clearAuthStorage();
      }
      throw new Error(retryRes.data.error || 'Xato');
    }
    clearAuthStorage();
  }

  throw new Error(res.data.error || 'Xato');
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body, options) => request('POST', path, body, options),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
  storeAuthSession,
  clearAuthStorage,
};
