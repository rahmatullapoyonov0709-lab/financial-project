import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../api";
import { useAppSettings } from "../context/AppSettingsContext";

const GOOGLE_SCRIPT_ID = "fintrack-google-identity";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function GoogleAuthButton({ remember = true, onSuccess }) {
  const { t } = useAppSettings();
  const buttonRef = useRef(null);
  const rememberRef = useRef(remember);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    rememberRef.current = remember;
  }, [remember]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !buttonRef.current) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          if (!response?.credential) {
            toast.error("Google credential kelmadi");
            return;
          }

          setLoading(true);
          try {
            const res = await api.post("/auth/google", {
              credential: response.credential,
            });

            api.storeAuthSession(res.data, { remember: rememberRef.current });
            toast.success(
              t("auth.login.toasts.welcome", { name: res.data.user.name })
            );
            onSuccess?.(res.data.user);
          } catch (error) {
            toast.error(
              error?.response?.data?.message ||
                error?.message ||
                "Google login xato"
            );
          } finally {
            setLoading(false);
          }
        },
      });

      buttonRef.current.innerHTML = "";

      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
        width: 320,
        logo_alignment: "left",
      });
    };

    const existing = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existing) {
      initGoogle();
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);
  }, [onSuccess, t]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed rounded-2xl border border-white/10 bg-dark-900/50 px-4 py-3.5 text-sm font-medium text-gray-500"
      >
        Google client id yo‘q
      </button>
    );
  }

  return (
    <div className="flex w-full justify-center">
      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-white">
          <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      ) : (
        <div ref={buttonRef} />
      )}
    </div>
  );
}