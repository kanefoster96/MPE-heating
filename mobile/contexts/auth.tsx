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
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * Who's using the app (Kanvas Academy's auth context). Nobody has to sign
 * in: Home, services, guides and booking work for everyone, and chat makes
 * an anonymous guest the first time it's opened, like the website's chat.
 * Signing in (the avatar, top left) is by a 6-digit code emailed to them,
 * no password; their guest chat comes with them.
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

  const sendCode = useCallback(async (email: string) => {
    if (!supabase) throw new Error("Accounts aren't switched on yet.");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
    if (error) throw new Error(error.status === 429 ? "Too many tries. Wait a minute, then ask for a new code." : "Couldn't send a code to that email. Check it and try again.");
  }, []);

  const verifyCode = useCallback(
    async (email: string, code: string) => {
      if (!supabase) throw new Error("Accounts aren't switched on yet.");
      // The guest they were chatting as, so their chat can come with them.
      const guestToken = sessionRef.current?.user.is_anonymous ? sessionRef.current.access_token : null;
      const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
      if (error || !data.session) throw new Error("That code didn't work. Check it, or ask for a new one.");
      sessionRef.current = data.session;
      setSession(data.session);
      if (guestToken) await apiPost("/api/mobile/claim", { guestToken }).catch(() => {});
      await refreshMe();
      registerForPush();
    },
    [refreshMe],
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
      sendCode,
      verifyCode,
      signOut,
    }),
    [session, me, refreshMe, ensureSession, sendCode, verifyCode, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth outside AuthProvider");
  return value;
}
