import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Landmark,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../api";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { useAppSettings } from "../context/AppSettingsContext";

const highlights = [
  { icon: TrendingUp, tone: "text-success-400", key: "auth.login.features.f1" },
  { icon: Landmark, tone: "text-primary-400", key: "auth.login.features.f2" },
  {
    icon: ShieldCheck,
    tone: "text-warning-500",
    key: "auth.login.features.f3",
  },
  { icon: Sparkles, tone: "text-purple-400", key: "auth.login.features.f4" },
];

export default function Login({
  onLogin,
  onGoRegister,
  onGoForgot,
  invitePending = false,
}) {
  const { t } = useAppSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      toast.error(t("auth.login.toasts.required"));
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      api.storeAuthSession(res.data, { remember: rememberMe });
      toast.success(
        t("auth.login.toasts.welcome", { name: res.data.user.name }),
      );
      onLogin(res.data.user);
    } catch (error) {
      toast.error(error.message || t("auth.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-dark-950 font-sans selection:bg-primary-500/30">
      {/* Premium Background Image with Overlay */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            'url("https://images.unsplash.com/photo-1618044733300-9472054094ee?q=80&w=2671&auto=format&fit=crop")',
        }}
      >
        <div className="absolute inset-0 bg-dark-950/80 backdrop-blur-[2px]"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/60 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/80 to-transparent lg:w-2/3"></div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1400px] items-center px-4 py-8 sm:px-6 lg:px-12">
        <div className="grid w-full gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-20 xl:grid-cols-[1.3fr_0.7fr]">
          {/* Left Side: Premium Copy & Branding */}
          <section className="hidden lg:flex flex-col justify-center py-10">
            <div className="inline-flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-xl shadow-primary-500/20 ring-1 ring-white/10">
                <Landmark className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  FinTrack <span className="text-primary-400">Pro</span>
                </h1>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400">
                  Wealth Management
                </p>
              </div>
            </div>

            <div className="mt-16 max-w-2xl">
              <h2 className="text-5xl font-extrabold leading-[1.15] tracking-tight text-white xl:text-6xl">
                Master your <br />
                <span className="bg-gradient-to-r from-primary-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
                  financial future
                </span>
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-gray-300/90 font-light max-w-xl">
                Experience the next generation of personal wealth tracking.
                Unified accounts, advanced analytics, and beautiful design—all
                in one secure platform.
              </p>
            </div>

            <div className="mt-16 grid gap-4 grid-cols-2 max-w-2xl">
              {highlights.map((item) => (
                <div
                  key={item.key}
                  className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 p-5 backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/10"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
                  <div
                    className={`relative flex h-12 w-12 items-center justify-center rounded-xl bg-dark-900/50 ring-1 ring-white/10 ${item.tone} shadow-inner`}
                  >
                    <item.icon className="h-6 w-6" />
                  </div>
                  <p className="relative mt-4 text-sm font-medium text-gray-200">
                    {t(item.key)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Right Side: Glassmorphic Login Form */}
          <section className="flex flex-col justify-center">
            <div className="relative w-full overflow-hidden rounded-[2.5rem] border border-white/10 bg-dark-900/60 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-12 lg:p-10 xl:p-12">
              {/* Subtle inner glow */}
              <div className="absolute inset-0 rounded-[2.5rem] shadow-[inset_0_0_40px_rgba(255,255,255,0.02)] border-[0.5px] border-white/5 pointer-events-none"></div>

              <div className="relative sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex items-center gap-3 lg:hidden mb-10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-lg shadow-primary-500/20">
                    <Landmark className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white">
                      FinTrack
                    </h2>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                      Workspace
                    </p>
                  </div>
                </div>

                <div className="mb-10 text-center lg:text-left">
                  <h2 className="text-3xl font-bold tracking-tight text-white">
                    {t("auth.login.welcome")}
                  </h2>
                  <p className="mt-3 text-base text-gray-300">
                    {t("auth.login.subtitle")}
                  </p>
                </div>

                {invitePending && (
                  <div className="mb-6 rounded-2xl border border-primary-500/20 bg-primary-500/10 px-5 py-4 flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-primary-400 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-primary-300">
                      {t("household.invite.pending")}
                    </p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300">
                      {t("auth.login.email")}
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-500 transition-colors group-focus-within:text-primary-400" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="john@example.com"
                        className="block w-full rounded-2xl border-0 bg-dark-950/60 py-4 pl-12 pr-4 text-white shadow-sm ring-1 ring-inset ring-white/20 transition-all placeholder:text-gray-500 focus:bg-dark-900 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm sm:leading-6"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300">
                        {t("auth.login.password")}
                      </label>
                      <button
                        type="button"
                        onClick={onGoForgot}
                        className="text-sm font-medium text-primary-400 transition-colors hover:text-primary-300"
                      >
                        {t("auth.login.forgot")}
                      </button>
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-500 transition-colors group-focus-within:text-primary-400" />
                      </div>
                      <input
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="••••••••"
                        className="block w-full rounded-2xl border-0 bg-dark-950/60 py-4 pl-12 pr-12 text-white shadow-sm ring-1 ring-inset ring-white/20 transition-all placeholder:text-gray-500 focus:bg-dark-900 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm sm:leading-6"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 transition-colors hover:text-white"
                      >
                        {showPw ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center pt-2">
                    <button
                      type="button"
                      onClick={() => setRememberMe((prev) => !prev)}
                      className="flex items-center gap-3 group"
                    >
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${rememberMe ? "bg-primary-500 border-primary-500" : "bg-dark-950 border-gray-600 group-hover:border-gray-500"}`}
                      >
                        {rememberMe && (
                          <svg
                            className="h-3.5 w-3.5 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                        {t("auth.login.remember")}
                      </span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="relative flex w-full justify-center items-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 py-4 text-sm font-semibold text-white shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] transition-all hover:scale-[1.02] hover:shadow-[0_0_60px_-15px_rgba(99,102,241,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:opacity-70 disabled:hover:scale-100"
                  >
                    {loading ? (
                      <div className="h-5 w-5 rounded-full border-2 border-white/25 border-t-white animate-spin" />
                    ) : (
                      <>
                        <span>{t("auth.login.submit")}</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-8">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase tracking-widest font-medium">
                      <span className="bg-dark-900 px-4 text-gray-300">
                        {t("auth.or")}
                      </span>
                    </div>
                  </div>

                  <div className="mt-8">
                    <GoogleAuthButton
                      type="signin"
                      remember={rememberMe}
                      onSuccess={onLogin}
                    />
                  </div>
                </div>

                <p className="mt-10 text-center text-sm text-gray-300">
                  {t("auth.login.noAccount")}{" "}
                  <button
                    onClick={onGoRegister}
                    className="font-semibold text-white transition-colors hover:text-primary-400 hover:underline underline-offset-4"
                  >
                    {t("auth.login.goRegister")}
                  </button>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
