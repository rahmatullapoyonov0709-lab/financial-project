const RAW_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const TX_CHANGED_EVENT = "fintrack:transactions-changed";
const TX_CHANGED_KEY = "fintrack:transactions:last-change";

const normalizeBaseUrl = (value) => {
  if (!value) return "http://localhost:5000/api";
  let base = String(value).trim();
  base = base.replace(/\/+$/, "");
  if (!base.endsWith("/api")) base += "/api";
  return base;
};

const BASE = normalizeBaseUrl(import.meta.env.VITE_API_URL);
const REFRESH_PATH = "/auth/refresh";

const safeStorage = {
  getItem(key) {
    try { return localStorage.getItem(key) || sessionStorage.getItem(key); } 
    catch { return null; }
  },
  setItem(key, value, remember = true) {
    try {
      const target = remember ? localStorage : sessionStorage;
      const fallback = remember ? sessionStorage : localStorage;
      fallback.removeItem(key);
      target.setItem(key, value);
    } catch {}
  },
  removeItem(key) {
    try { localStorage.removeItem(key); sessionStorage.removeItem(key); } 
    catch {}
  },
};

const clearAuthStorage = () => {
  safeStorage.removeItem("token");
  safeStorage.removeItem("refreshToken");
  safeStorage.removeItem("user");
};

const getAuthToken = () => safeStorage.getItem("token");
const getRefreshToken = () => safeStorage.getItem("refreshToken");

const storeAuthSession = (payload, { remember = true } = {}) => {
  // Backenddan 'token' yoki 'accessToken' kelishiga qarab saqlaymiz
  const token = payload.accessToken || payload.token;
  const refresh = payload.refreshToken;
  const user = payload.user;

  if (token) safeStorage.setItem("token", token, remember);
  if (refresh) safeStorage.setItem("refreshToken", refresh, remember);
  if (user) safeStorage.setItem("user", JSON.stringify(user), remember);
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
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") || "";
    let data;
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { error: text || "Server xatosi" };
    }

    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    throw new Error(error.name === "AbortError" ? "Vaqt tugadi" : "Serverga ulanib bo'lmadi");
  } finally {
    clearTimeout(timeoutId);
  }
};

async function request(method, path, body, options = {}) {
  const token = getAuthToken();
  const res = await rawRequest({ method, path, body, token });

  if (res.ok) return res.data;

  // Agar 401 (Unauthorized) bo'lsa, tokenni yangilab ko'ramiz
  if (res.status === 401 && path !== REFRESH_PATH && !options.skipRetry) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      const refreshRes = await rawRequest({
        method: "POST",
        path: REFRESH_PATH,
        body: { refreshToken }
      });

      if (refreshRes.ok) {
        const newData = refreshRes.data.data || refreshRes.data;
        storeAuthSession(newData);
        // Qayta urinib ko'ramiz
        const retryRes = await rawRequest({ method, path, body, token: getAuthToken() });
        if (retryRes.ok) return retryRes.data;
      }
    }
    clearAuthStorage();
    window.location.href = "/login";
  }

  throw new Error(res.data?.error || res.data?.message || "Xato yuz berdi");
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body, options) => request("POST", path, body, options),
  put: (path, body) => request("PUT", path, body),
  delete: (path) => request("DELETE", path),
  storeAuthSession,
  clearAuthStorage,
};