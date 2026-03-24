const RAW_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const REFRESH_PATH = "/auth/refresh";

const TX_CHANGED_EVENT = "fintrack:transactions-changed";
const TX_CHANGED_KEY = "fintrack:transactions:last-change";
const NOTIFICATION_CHANGED_EVENT = "fintrack:notifications-changed";
const NOTIFICATION_CHANGED_KEY = "fintrack:notifications:last-change";

const normalizeBaseUrl = (value) => {
  if (!value) return "http://localhost:5000";

  let base = String(value).trim();

  // noto'g'ri yozilgan envlarni tozalash
  base = base.replace(/^VITE_API_URL\s*=\s*/i, "");
  base = base.replace(/^\/+/, "");
  base = base.replace(/\/+$/, "");

  // agar /api bilan tugasa ham kesib tashlaymiz
  base = base.replace(/\/api$/i, "");

  return base;
};

const BASE = normalizeBaseUrl(RAW_BASE);

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
      // ignore
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

const clearAuthStorage = () => {
  safeStorage.removeItem("token");
  safeStorage.removeItem("refreshToken");
  safeStorage.removeItem("user");
};

const getAuthToken = () => safeStorage.getItem("token");
const getRefreshToken = () => safeStorage.getItem("refreshToken");

const shouldRememberSession = () => {
  try {
    return Boolean(localStorage.getItem("refreshToken"));
  } catch {
    return true;
  }
};

const storeAuthSession = (
  { accessToken, refreshToken, user },
  { remember = true } = {}
) => {
  safeStorage.setItem("token", accessToken, remember);
  safeStorage.setItem("refreshToken", refreshToken, remember);
  safeStorage.setItem("user", JSON.stringify(user), remember);
};

const shouldBroadcastTransactionChange = (method, path) => {
  if (method === "GET" || !path) return false;
  return (
    path === "/transactions" ||
    path.startsWith("/transactions?") ||
    path.startsWith("/transactions/")
  );
};

const shouldBroadcastNotificationChange = (method, path) => {
  if (method === "GET" || !path) return false;
  return (
    path === "/notifications" ||
    path.startsWith("/notifications?") ||
    path.startsWith("/notifications/")
  );
};

const broadcastTransactionChange = () => {
  const timestamp = String(Date.now());
  try {
    localStorage.setItem(TX_CHANGED_KEY, timestamp);
  } catch {}

  try {
    window.dispatchEvent(
      new CustomEvent(TX_CHANGED_EVENT, { detail: { timestamp } })
    );
  } catch {}
};

const broadcastNotificationChange = () => {
  const timestamp = String(Date.now());
  try {
    localStorage.setItem(NOTIFICATION_CHANGED_KEY, timestamp);
  } catch {}

  try {
    window.dispatchEvent(
      new CustomEvent(NOTIFICATION_CHANGED_EVENT, { detail: { timestamp } })
    );
  } catch {}
};

const parseResponse = async (res) => {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return { error: "JSON javobni o'qib bo'lmadi" };
    }
  }

  const text = await res.text().catch(() => "");
  return {
    error: text || "Serverdan noto'g'ri javob qaytdi",
  };
};

const buildUrl = (path) => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${BASE}${cleanPath}`;
};

const rawRequest = async ({ method, path, body, token }) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(buildUrl(path), {
      method,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });

    const data = await parseResponse(res);
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("So'rov vaqti tugadi, qayta urinib ko'ring");
    }
    throw new Error("Serverga ulanib bo'lmadi");
  } finally {
    clearTimeout(timeoutId);
  }
};

let refreshPromise = null;

const refreshAccessToken = async () => {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  refreshPromise = (async () => {
    const res = await rawRequest({
      method: "POST",
      path: REFRESH_PATH,
      body: { refreshToken },
      token: null,
    });

    if (!res.ok) {
      clearAuthStorage();
      return false;
    }

    const remember = shouldRememberSession();
    const payload = res.data?.data || res.data;

    safeStorage.setItem("token", payload.accessToken, remember);
    safeStorage.setItem("refreshToken", payload.refreshToken, remember);

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

  const canRetry =
    !options.skipRetry && res.status === 401 && path !== REFRESH_PATH;

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

      throw new Error(retryRes.data?.error || "Xato");
    }

    clearAuthStorage();
  }

  throw new Error(res.data?.error || "Xato");
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body, options) => request("POST", path, body, options),
  put: (path, body) => request("PUT", path, body),
  delete: (path) => request("DELETE", path),
  storeAuthSession,
  clearAuthStorage,
};