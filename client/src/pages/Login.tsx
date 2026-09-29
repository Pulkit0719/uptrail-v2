import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { UptrailLogo } from "@/components/UptrailLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "login" | "register" | "forgot" | "reset";

function safeReturnPath() {
  const value = new URLSearchParams(window.location.search).get("returnTo") ?? "/dashboard";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const resetToken = new URLSearchParams(window.location.search).get("resetToken");
  const [mode, setMode] = useState<Mode>(resetToken ? "reset" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const finish = async () => {
    await utils.auth.me.invalidate();
    setLocation(safeReturnPath());
  };
  const login = trpc.auth.login.useMutation({ onSuccess: finish });
  const register = trpc.auth.register.useMutation({ onSuccess: finish });
  const requestReset = trpc.auth.requestPasswordReset.useMutation();
  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      window.history.replaceState({}, "", "/login");
      setPassword("");
      setMode("login");
    },
  });
  const mutation = mode === "login" ? login : mode === "register" ? register : mode === "forgot" ? requestReset : reset;
  const title = mode === "login" ? "Welcome back." : mode === "register" ? "Create your Uptrail account." : mode === "forgot" ? "Reset your password." : "Choose a new password.";

  return <main className="grid min-h-screen place-items-center bg-[#F4F7F3] px-5 py-12">
    <section className="w-full max-w-md rounded-[1.8rem] border border-[#E0E7E1] bg-white p-7 shadow-[0_24px_65px_rgba(24,48,47,0.11)] sm:p-9">
      <UptrailLogo className="justify-center" />
      <h1 className="mt-7 text-center font-display text-3xl font-semibold tracking-[-0.05em] text-[#18302F]">{title}</h1>
      <p className="mt-2 text-center text-sm leading-6 text-[#687871]">Independent, secure access to your career workspace.</p>
      {(mode === "login" || mode === "register") && <div className="mt-7 grid grid-cols-2 rounded-xl bg-[#F0F4F1] p-1">
        {(["login", "register"] as const).map(item => <button type="button" key={item} onClick={() => setMode(item)} className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === item ? "bg-white text-[#18302F] shadow-sm" : "text-[#718079]"}`}>{item === "login" ? "Sign in" : "Register"}</button>)}
      </div>}
      <form className="mt-6 space-y-4" onSubmit={event => {
        event.preventDefault();
        if (mode === "login") login.mutate({ email, password });
        else if (mode === "register") register.mutate({ name, email, password });
        else if (mode === "forgot") requestReset.mutate({ email });
        else if (resetToken) reset.mutate({ token: resetToken, password });
      }}>
        {mode === "register" && <label className="grid gap-1.5 text-sm font-bold text-[#40534C]">Name<Input autoComplete="name" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={120} required className="h-11 rounded-xl" /></label>}
        {mode !== "reset" && <label className="grid gap-1.5 text-sm font-bold text-[#40534C]">Email<Input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required className="h-11 rounded-xl" /></label>}
        {mode !== "forgot" && <label className="grid gap-1.5 text-sm font-bold text-[#40534C]">Password<Input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} minLength={mode === "login" ? 1 : 12} maxLength={128} required className="h-11 rounded-xl" /></label>}
        {(mode === "register" || mode === "reset") && <p className="text-xs leading-5 text-[#76857E]">Use at least 12 characters. Passwords are salted and hashed before storage.</p>}
        {requestReset.isSuccess && <p role="status" className="rounded-xl bg-[#EDF7F2] px-3 py-2 text-sm text-[#315E4D]">If that account exists, a reset link has been sent.</p>}
        {reset.isSuccess && <p role="status" className="rounded-xl bg-[#EDF7F2] px-3 py-2 text-sm text-[#315E4D]">Password updated. You can now sign in.</p>}
        {mutation.error && <p role="alert" className="rounded-xl bg-[#FFF1EC] px-3 py-2 text-sm text-[#9A4F36]">{mutation.error.message}</p>}
        <Button disabled={mutation.isPending || (mode === "reset" && !resetToken)} className="h-11 w-full rounded-xl bg-[#18302F] font-bold text-white hover:bg-[#244442]">{mutation.isPending ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"}</Button>
      </form>
      {mode === "login" && <button type="button" onClick={() => setMode("forgot")} className="mt-4 w-full text-center text-sm font-semibold text-[#577068]">Forgot password?</button>}
      {(mode === "forgot" || mode === "reset") && <button type="button" onClick={() => setMode("login")} className="mt-4 w-full text-center text-sm font-semibold text-[#577068]">Back to sign in</button>}
      <button onClick={() => setLocation("/")} className="mt-5 w-full text-center text-sm font-semibold text-[#577068]">Back to Uptrail</button>
    </section>
  </main>;
}
