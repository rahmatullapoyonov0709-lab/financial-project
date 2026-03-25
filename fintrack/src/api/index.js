// Agarda .env dan noto'g'ri qiymat kelsa ham, uni tozalaydigan funksiya
const getBaseUrl = () => {
  let url = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  
  // Agar URL ichida VITE_API_URL degan yozuv bo'lsa (rasmdagi xato), uni olib tashlaymiz
  if (url.includes("VITE_API_URL_")) {
    url = url.split("VITE_API_URL_")[1];
  }
  
  // Bo'sh joylarni va oxiridagi / belgisini olib tashlaymiz
  url = url.trim().replace(/\/+$/, "");
  
  // Agar oxiri /api bilan tugamasa, qo'shib qo'yamiz
  if (!url.endsWith("/api")) {
    url += "/api";
  }
  
  return url;
};

const BASE = getBaseUrl();

// Qolgan hamma narsa sening original kodingdek:
const safeStorage = {
  getItem(key) {
    try { return localStorage.getItem(key) || sessionStorage.getItem(key); } catch { return null; }
  },
  setItem(key, value, remember = true) {
    try {
      const target = remember ? localStorage : sessionStorage;
      target.setItem(key, value);
    } catch {}
  },
  removeItem(key) {
    try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch {}
  }
};

const buildUrl = (path) => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  // MANA SHU JOYDA URL TO'G'RI YIG'ILADI
  return `${BASE}${cleanPath}`;
};

const rawRequest = async ({ method, path, body, token }) => {
  try {
    const res = await fetch(buildUrl(path), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json() : await res.text();
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    throw new Error("Serverga ulanib bo'lmadi");
  }
};

async function request(method, path, body) {
  const token = safeStorage.getItem("token");
  const res = await rawRequest({ method, path, body, token });
  if (res.ok) return res.data;
  throw new Error(res.data?.error || "Xato");
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  delete: (path) => request("DELETE", path),
  storeAuthSession: (payload) => {
    const token = payload.accessToken || payload.token;
    if (token) safeStorage.setItem("token", token);
    if (payload.user) safeStorage.setItem("user", JSON.stringify(payload.user));
  }
};