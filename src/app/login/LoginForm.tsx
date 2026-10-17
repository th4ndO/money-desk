"use client";

import { useActionState, useState } from "react";
import { type LoginState, sendLink, verifyCode } from "./actions";

const initial: LoginState = { step: "email" };

/** Remounting with a new key resets both steps to a blank email form. */
export function LoginForm({ notice }: { notice?: string }) {
  const [attempt, setAttempt] = useState(0);
  return <Steps key={attempt} notice={attempt === 0 ? notice : undefined} onRestart={() => setAttempt((n) => n + 1)} />;
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
