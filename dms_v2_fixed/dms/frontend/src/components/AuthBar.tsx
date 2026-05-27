'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export function AuthBar() {
  const disabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || disabled) {
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [disabled]);

  if (disabled) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
        Auth disabled for local development (API <code className="font-mono">AUTH_DISABLED=true</code>).
      </div>
    );
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
        Configure <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
      </div>
    );
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
    }
  }

  async function signOut() {
    setBusy(true);
    await supabase.auth.signOut();
    setBusy(false);
  }

  if (sessionEmail) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
        <span className="text-slate-400">
          Signed in as <span className="text-slate-100">{sessionEmail}</span>
        </span>
        <button
          type="button"
          onClick={signOut}
          disabled={busy}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-900"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={signIn} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col text-xs text-slate-400">
        Email
        <input
          className="mt-1 w-52 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
      </label>
      <label className="flex flex-col text-xs text-slate-400">
        Password
        <input
          type="password"
          className="mt-1 w-40 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
      >
        Sign in
      </button>
      {message ? <span className="text-xs text-rose-300">{message}</span> : null}
    </form>
  );
}
