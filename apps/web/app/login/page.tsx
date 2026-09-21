"use client";

import { useState } from "react";
import { createBrowserSupabase } from "../../lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setStatus(error ? error.message : "Check your email for a magic link.");
  }

  async function continueAnonymously() {
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInAnonymously();
    setStatus(error ? error.message : "Signed in anonymously on this device.");
  }

  return (
    <main className="stack">
      <h1>Sign in</h1>
      <p className="lede">Magic link for an account, or stay anonymous for Explore.</p>
      <form className="card stack" onSubmit={onSubmit}>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <button type="submit">Send magic link</button>
        <button type="button" onClick={continueAnonymously} style={{ background: "#5c564c" }}>
          Continue anonymously
        </button>
        {status ? <p className="muted">{status}</p> : null}
      </form>
    </main>
  );
}
