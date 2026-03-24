import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../api";
import { useAppSettings } from "../context/AppSettingsContext";

const GOOGLE_SCRIPT_ID = "fintrack-google-identity";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function GoogleAuthButton({
  remember = true,
  onSuccess,
  type = "signin",
}) {
  const { t } = useAppSettings();
  const containerRef = useRef(null);
  const rememberRef = useRef(remember);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    rememberRef.current = remember;
  }, [remember]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      return;
    }

    const renderButton = () => {
      if (!window.google?.accounts?.id || !containerRef.current) {
        return;
      }

      containerRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            const res = await api.post("/auth/google", {
              credential: response.credential,
            });
            api.storeAuthSession(res.data, { remember: rememberRef.current });
            toast.success(
              t("auth.login.toasts.welcome", { name: res.data.user.name }),
            );
            onSuccess?.(res.data.user);
          } catch (error) {
            toast.error(error.message || t("auth.error"));
          }
        },
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: type === "signup" ? "signup_with" : "signin_with",
        shape: "pill",
        locale: "uz_UZ", // Force Uzbek language on the Google button
      });
      setReady(true);
    };

    const existing = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existing) {
      renderButton();
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    document.head.appendChild(script);
  }, [onSuccess, t, type]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed rounded-2xl border border-gray-700 bg-dark-900 px-4 py-3 text-sm font-medium text-gray-500"
      >
        {t("auth.google.unavailable")}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className={`min-h-[44px] ${ready ? "" : "opacity-70"}`}
      />
    </div>
  );
}
