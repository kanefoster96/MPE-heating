import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { apiFetch, apiPost } from "@/lib/api";
import { registerForPush, setIconBadge, unregisterPush } from "@/lib/push";

/** What /api/mobile/me says about whoever's signed in. */
export type Me = {
  user: { id: string; email: string | null; name: string | null; avatarUrl: string | null; guest: boolean };
  staff: boolean;
  admin: boolean;
  unreadChats: number;
  waiting: number;
};

type AuthState = {
  /** Whether sign-in and chat are switched on in this build (lib/supabase.ts). */
  on: boolean;
  session: Session | null;
  me: Me | null;
  /** Signed in with an email (not just chatting as a guest). */
  signedIn: boolean;
  staff: boolean;
  unreadChats: number;
  waiting: number;
  refreshMe: () => Promise<void>;
  /** A session for chat: their own, or an anonymous guest's, made the first time. */
  ensureSession: () => Promise<Session | null>;
  /** Emails the "Confirm my email" button. `password` only for Apple's review login. */
  sendLink: (email: string) => Promise<{ password: boolean }>;
  /** The button was tapped: `t` from the email, `h` back from the website. */
  signInWithLink: (link: { t?: string; h?: string }) => Promise<void>;
  /** Apple's review login only (APP_REVIEW_EMAIL on the site). */
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * Who's using the app (Kanvas Academy's auth context). Nobody has to sign
 * in: Home, services, guides and booking work for everyone, and chat makes
 * an anonymous guest the first time it's opened, like the website's chat.
 * Signing in (the avatar, top left) is by a "Confirm my email" button we
 * email them, no password (src/lib/app-sign-in.ts on the site); their
 * guest chat comes with them.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const refreshMe = useCallback(async () => {
    if (!sessionRef.current) {
      setMe(null);
      setIconBadge(0);
      return;
    }
    try {
      const next = await apiFetch<Me>("/api/mobile/me");
      setMe(next);
      setIconBadge(next.unreadChats + next.waiting);
    } catch {
      // Keep what we had: a dropped signal shouldn't sign anyone out.
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      sessionRef.current = data.session;
      setSession(data.session);
      if (data.session) refreshMe();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      const changed = next?.user.id !== sessionRef.current?.user.id;
      sessionRef.current = next;
      setSession(next);
      if (changed) refreshMe();
    });
    // Back from the background: the counts may have moved.
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshMe();
    });
    return () => {
      sub.subscription.unsubscribe();
      appState.remove();
    };
  }, [refreshMe]);

  const ensureSession = useCallback(async () => {
    if (!supabase) return null;
    if (sessionRef.current) return sessionRef.current;
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) return existing.session;
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error("Couldn't start the chat. Please try again.");
    sessionRef.current = data.session;
    setSession(data.session);
    return data.session;
  }, []);

  const sendLink = useCallback(async (email: string) => {
    if (!supabase) throw new Error("Accounts aren't switched on yet.");
    const res = await apiPost<{ ok: true; password: boolean }>("/api/mobile/auth/send-link", { email: email.trim() });
    return { password: !!res.password };
  }, []);

  // Once a session's in: bring a guest's chat across, then the counts and pushes.
  const finishSignIn = useCallback(
    async (session: Session, guestToken: string | null) => {
      sessionRef.current = session;
      setSession(session);
      if (guestToken) await apiPost("/api/mobile/claim", { guestToken }).catch(() => {});
      await refreshMe();
      registerForPush();
    },
    [refreshMe],
  );

  const signInWithLink = useCallback(
    async (link: { t?: string; h?: string }) => {
      if (!supabase) throw new Error("Accounts aren't switched on yet.");
      // The guest they were chatting as, so their chat can come with them.
      // Read from storage: the link may have just cold-started the app.
      const current = (await supabase.auth.getSession()).data.session;
      const guestToken = current?.user.is_anonymous ? current.access_token : null;
      const { tokenHash } = await apiPost<{ tokenHash: string }>("/api/mobile/auth/confirm-link", link);
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (error || !data.session) throw new Error("Something went wrong signing you in. Please ask for a new link.");
      await finishSignIn(data.session, guestToken);
    },
    [finishSignIn],
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      if (!supabase) throw new Error("Accounts aren't switched on yet.");
      const guestToken = sessionRef.current?.user.is_anonymous ? sessionRef.current.access_token : null;
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error || !data.session) throw new Error("That email and password don't match.");
      await finishSignIn(data.session, guestToken);
    },
    [finishSignIn],
  );

  const signOut = useCallback(async () => {
    await unregisterPush();
    await supabase?.auth.signOut().catch(() => {});
    sessionRef.current = null;
    setSession(null);
    setMe(null);
    setIconBadge(0);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      on: !!supabase,
      session,
      me,
      signedIn: !!session && !session.user.is_anonymous,
      staff: !!me?.staff,
      unreadChats: me?.unreadChats ?? 0,
      waiting: me?.waiting ?? 0,
      refreshMe,
      ensureSession,
      sendLink,
      signInWithLink,
      signInWithPassword,
      signOut,
    }),
    [session, me, refreshMe, ensureSession, sendLink, signInWithLink, signInWithPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth outside AuthProvider");
  return value;
}
