import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Landmark,
  Lock,
  Mail,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../api";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { useAppSettings } from "../context/AppSettingsContext";

const benefits = [
  { icon: Wallet, key: "auth.register.features.f1", tone: "text-success-400" },
  {
    icon: ShieldCheck,
    key: "auth.register.features.f2",
    tone: "text-primary-400",
  },
  { icon: Mail, key: "auth.register.features.f3", tone: "text-warning-500" },
  { icon: Landmark, key: "auth.register.features.f4", tone: "text-teal-400" },
];

export default function Register({
  onLogin,
  onGoLogin,
  invitePending = false,
}) {
  const { t } = useAppSettings();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast.error(t("auth.register.toasts.required"));
      return;
    }
    if (form.password.length < 6) {
      toast.error(t("auth.register.toasts.minPassword"));
      return;
    }
    if (form.password !== form.confirm) {
      toast.error(t("auth.register.toasts.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
      });
      api.storeAuthSession(res.data, { remember: true });
      toast.success(t("auth.register.toasts.created"));
      onLogin(res.data.user);
    } catch (error) {
      toast.error(error.message || t("auth.error"));
    } finally {
      setLoading(false);
    }
  };

  const field = (key) => ({
    value: form[key],
    onChange: (event) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value })),
  });

  return (
    <div className="relative min-h-screen bg-dark-950 font-sans selection:bg-success-500/30">
      {/* Premium Background Image with Overlay */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            'url("https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=2671&auto=format&fit=crop")',
        }}
      >
        <div className="absolute inset-0 bg-dark-950/85 backdrop-blur-[3px]"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/70 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-dark-950/40 to-dark-950 lg:w-1/2 lg:left-1/2"></div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1400px] items-center px-4 py-8 sm:px-6 lg:px-12">
        <div className="grid w-full gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20 xl:grid-cols-[0.8fr_1.2fr]">
          {/* Left Side: Right-aligned form */}
          <section className="flex flex-col justify-center order-2 lg:order-1">
            <div className="relative w-full overflow-hidden rounded-[2.5rem] border border-white/10 bg-dark-900/65 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-12 lg:p-10 xl:p-12">
              <div className="absolute inset-0 rounded-[2.5rem] shadow-[inset_0_0_40px_rgba(255,255,255,0.02)] border-[0.5px] border-white/5 pointer-events-none"></div>

              <div className="relative sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex items-center gap-3 lg:hidden mb-10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-success-400 to-success-600 text-white shadow-lg shadow-success-500/20">
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
                    {t("auth.register.title")}
                  </h2>
                  <p className="mt-3 text-base text-gray-300">
                    {t("auth.register.subtitle")}
                  </p>
                </div>

                {invitePending && (
                  <div className="mb-6 rounded-2xl border border-success-500/20 bg-success-500/10 px-5 py-4 flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-success-400 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-success-300">
                      {t("household.invite.pending")}
                    </p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300">
                      {t("auth.register.name")}
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-500 transition-colors group-focus-within:text-success-400" />
                      </div>
                      <input
                        {...field("name")}
                        type="text"
                        placeholder={t("auth.register.namePlaceholder")}
                        className="block w-full rounded-2xl border-0 bg-dark-950/60 py-3.5 pl-12 pr-4 text-white shadow-sm ring-1 ring-inset ring-white/20 transition-all placeholder:text-gray-500 focus:bg-dark-900 focus:ring-2 focus:ring-inset focus:ring-success-500 sm:text-sm sm:leading-6"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300">
                      {t("auth.register.email")}
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-500 transition-colors group-focus-within:text-success-400" />
                      </div>
                      <input
                        {...field("email")}
                        type="email"
                        placeholder="email@example.com"
                        className="block w-full rounded-2xl border-0 bg-dark-950/60 py-3.5 pl-12 pr-4 text-white shadow-sm ring-1 ring-inset ring-white/20 transition-all placeholder:text-gray-500 focus:bg-dark-900 focus:ring-2 focus:ring-inset focus:ring-success-500 sm:text-sm sm:leading-6"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300">
                        {t("auth.register.password")}
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Lock className="h-4 w-4 text-gray-500 transition-colors group-focus-within:text-success-400" />
                        </div>
                        <input
                          {...field("password")}
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••"
                          className="block w-full rounded-2xl border-0 bg-dark-950/60 py-3.5 pl-10 pr-9 text-white shadow-sm ring-1 ring-inset ring-white/20 transition-all placeholder:text-gray-500 focus:bg-dark-900 focus:ring-2 focus:ring-inset focus:ring-success-500 sm:text-sm sm:leading-6"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 transition-colors hover:text-white"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 shrink-0 truncate">
                        {t("auth.register.confirmPassword")}
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Lock className="h-4 w-4 text-gray-500 transition-colors group-focus-within:text-success-400" />
                        </div>
                        <input
                          {...field("confirm")}
                          type="password"
                          placeholder="••••••"
                          className="block w-full rounded-2xl border-0 bg-dark-950/60 py-3.5 pl-10 pr-4 text-white shadow-sm ring-1 ring-inset ring-white/20 transition-all placeholder:text-gray-500 focus:bg-dark-900 focus:ring-2 focus:ring-inset focus:ring-success-500 sm:text-sm sm:leading-6"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="relative mt-2 flex w-full justify-center items-center gap-2 rounded-2xl bg-gradient-to-r from-success-600 to-emerald-500 py-4 text-sm font-semibold text-white shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] transition-all hover:scale-[1.02] hover:shadow-[0_0_60px_-15px_rgba(16,185,129,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success-500 disabled:opacity-70 disabled:hover:scale-100"
                  >
                    {loading ? (
                      <div className="h-5 w-5 rounded-full border-2 border-white/25 border-t-white animate-spin" />
                    ) : (
                      <>
                        <span>{t("auth.register.submit")}</span>
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
                      type="signup"
                      remember
                      onSuccess={onLogin}
                    />
                  </div>
                </div>

                <p className="mt-10 text-center text-sm text-gray-300">
                  {t("auth.register.hasAccount")}{" "}
                  <button
                    onClick={onGoLogin}
                    className="font-semibold text-white transition-colors hover:text-success-400 hover:underline underline-offset-4"
                  >
                    {t("auth.register.goLogin")}
                  </button>
                </p>
              </div>
            </div>
          </section>

          {/* Right Side: Copy & Branding */}
          <section className="hidden lg:flex flex-col justify-center py-10 order-1 lg:order-2">
            <div className="inline-flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-success-400 to-emerald-600 text-white shadow-xl shadow-success-500/20 ring-1 ring-white/10">
                <Landmark className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  FinTrack <span className="text-success-400">Pro</span>
                </h1>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400">
                  Join Workspace
                </p>
              </div>
            </div>

            <div className="mt-16 max-w-2xl">
              <h2 className="text-5xl font-extrabold leading-[1.15] tracking-tight text-white xl:text-6xl">
                Start building your <br />
                <span className="bg-gradient-to-r from-success-300 via-emerald-400 to-teal-500 bg-clip-text text-transparent">
                  wealth portfolio
                </span>
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-gray-300/90 font-light max-w-xl">
                Create your account in seconds. Sync offline, track shared
                budgets, and let AI analyze your spending patterns
                automatically.
              </p>
            </div>

            <div className="mt-16 grid gap-4 grid-cols-2 max-w-2xl">
              {benefits.map((item) => (
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
        </div>
      </div>
    </div>
  );
}
