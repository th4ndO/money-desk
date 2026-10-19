"use client";

import { useActionState, useState } from "react";
import { type LoginState, type PinState, pinSignIn, sendLink, verifyCode } from "./actions";

const initial: LoginState = { step: "email" };

/** PIN first; the email link is the fallback (e.g. after a lockout). */
export function LoginForm({ notice }: { notice?: string }) {
  const [mode, setMode] = useState<"pin" | "email">("pin");
  const [attempt, setAttempt] = useState(0);
  if (mode === "pin") {
    return (
      <div className="space-y-6">
        {notice && <p className="notice notice-bad" role="alert">{notice}</p>}
        <PinForm />
        <button type="button" className="btn btn-quiet w-full" onClick={() => setMode("email")}>
          Forgot your PIN? Email me a sign-in link
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <Steps key={attempt} notice={attempt === 0 ? notice : undefined} onRestart={() => setAttempt((n) => n + 1)} />
      <button type="button" className="btn btn-quiet w-full" onClick={() => setMode("pin")}>
        Use my PIN instead
      </button>
    </div>
  );
}

function PinForm() {
  const [state, action, pending] = useActionState<PinState, FormData>(pinSignIn, {});
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="pin" className="label">PIN</label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="current-password"
          minLength={4}
          maxLength={8}
          required
          autoFocus
          className="input money text-center text-2xl tracking-[0.5em]"
        />
      </div>
      {state.error && <p className="notice notice-bad" role="alert">{state.error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Checking…" : "Unlock"}
      </button>
    </form>
  );
}

function Steps({ notice, onRestart }: { notice?: string; onRestart: () => void }) {
  const [sendState, sendAction, sending] = useActionState(sendLink, initial);
  const [codeState, codeAction, verifying] = useActionState(verifyCode, initial);

  if (sendState.step === "email") {
    return (
      <form action={sendAction} className="space-y-4">
        {notice && <p className="notice notice-bad" role="alert">{notice}</p>}
        <div className="space-y-1.5">
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required className="input" />
        </div>
        {sendState.error && <p className="notice notice-bad" role="alert">{sendState.error}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={sending}>
          {sending ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
    );
  }

  const codeError = codeState.step === "code" ? codeState.error : undefined;

  return (
    <form action={codeAction} className="space-y-4">
      <p className="notice" role="status">
        If <strong className="break-all">{sendState.email}</strong> is allowed, a sign-in email is on its way.
        Tap the link in it, or type the code here.
      </p>
      <input type="hidden" name="email" value={sendState.email} />
      <div className="space-y-1.5">
        <label htmlFor="code" className="label">Code from the email</label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={10}
          required
          className="input money text-lg tracking-widest"
        />
      </div>
      {codeError && <p className="notice notice-bad" role="alert">{codeError}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={verifying}>
        {verifying ? "Checking…" : "Sign in"}
      </button>
      <button type="button" className="btn btn-quiet w-full" onClick={onRestart}>
        Use a different email or send again
      </button>
    </form>
  );
}
