import { useEffect, useState } from "react";
import { sendMessage } from "../../src/shared/messages";
import { loadCachedUser } from "../../src/beli/session";
import { formatPhoneInput } from "../../src/beli/phone";
import type { LoggedInUser } from "../../src/beli/types";

type Status = "loading" | "signed_out" | "signed_in";

function photoUrl(user: LoggedInUser): string | null {
  const raw = user.profile_photo || (typeof user.photo === "string" ? user.photo : null);
  return raw && raw.length > 0 ? raw : null;
}

function SessionSkeleton() {
  return (
    <section className="panel session-skeleton" aria-busy="true" aria-label="Loading session">
      <div className="who">
        <div className="avatar skeleton-circle" />
        <div className="skeleton-copy">
          <div className="skeleton-line name" />
          <div className="skeleton-line handle" />
        </div>
      </div>
      <div className="skeleton-line hint" />
      <div className="actions">
        <div className="skeleton-btn" />
        <div className="skeleton-btn ghost" />
      </div>
    </section>
  );
}

export function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const cached = await loadCachedUser();
      if (!cancelled && cached) {
        setUser(cached);
        setStatus("signed_in");
      }

      const res = await sendMessage({ type: "WHOAMI" });
      if (cancelled) return;

      if (res.ok && res.authenticated && res.user) {
        setUser(res.user);
        setStatus("signed_in");
      } else if (!cached) {
        setUser(null);
        setStatus("signed_out");
      } else if (!res.ok || !res.authenticated) {
        setUser(null);
        setStatus("signed_out");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await sendMessage({ type: "LOGIN", phone, password });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPassword("");
      setUser(res.user ?? null);
      setStatus("signed_in");
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    setBusy(true);
    try {
      await sendMessage({ type: "LOGOUT" });
      setUser(null);
      setStatus("signed_out");
    } finally {
      setBusy(false);
    }
  }

  function openMaps() {
    void chrome.tabs.create({ url: "https://www.google.com/maps" });
  }

  const avatar = user ? photoUrl(user) : null;

  return (
    <div className="page">
      <main className="frame">
        <header className="hero">
          <p className="logo">beli</p>
          <h1>Friend scores on Google Maps</h1>
          <p className="lede">
            Sign in with your Beli phone number. We store tokens only — never your password.
          </p>
        </header>

        {status === "loading" && <SessionSkeleton />}

        {status === "signed_in" && user && (
          <section className="panel">
            <div className="who">
              {avatar ? (
                <img className="avatar" src={avatar} alt="" />
              ) : (
                <div className="avatar fallback">
                  {(user.full_name || user.username).slice(0, 1)}
                </div>
              )}
              <div>
                <div className="name">{user.full_name || user.username}</div>
                <div className="handle">@{user.username}</div>
              </div>
            </div>
            <p className="hint">
              Open a restaurant place page on Google Maps — friend Beli scores show inline with
              Reviews.
            </p>
            <div className="actions">
              <button type="button" className="primary" onClick={openMaps}>
                Open Google Maps
              </button>
              <button
                type="button"
                className="ghost"
                disabled={busy}
                onClick={() => void onLogout()}
              >
                Sign out
              </button>
            </div>
          </section>
        )}

        {status === "signed_out" && (
          <form className="panel form" onSubmit={(e) => void onLogin(e)}>
            <label>
              Phone
              <input
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(555) 123-4567"
                required
                autoFocus
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
