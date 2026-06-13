"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Home, LoaderCircle, LockKeyhole, Mail, Settings2, ShoppingBasket, Users } from "lucide-react";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { CompleteProfile } from "@/components/auth/complete-profile";
import { Dashboard } from "@/components/dashboard/dashboard";
import { ThemeButton } from "@/components/shared/app-header";
import type { AuthMode, Profile, Theme } from "@/types/homehq";

export function HomeHqApp() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem("homehq-theme") as Theme | null;
    const initial = saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next); localStorage.setItem("homehq-theme", next); document.documentElement.dataset.theme = next; delete document.documentElement.dataset.housePalette;
  }

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    const loadUser = async (currentUser: User | null) => {
      setUser(currentUser);
      if (currentUser) {
        const profileCacheKey = `homehq-profile-${currentUser.id}`;
        const cachedProfile = localStorage.getItem(profileCacheKey);
        if (cachedProfile) {
          try {
            setProfile(JSON.parse(cachedProfile) as Profile);
            setLoading(false);
          } catch {
            localStorage.removeItem(profileCacheKey);
          }
        }
        const { data } = await supabase.from("profiles").select("username, gender, avatar_url, profile_completed_at, created_at").eq("id", currentUser.id).maybeSingle();
        if (data) {
          localStorage.setItem(profileCacheKey, JSON.stringify(data));
          setProfile(data);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => loadUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void loadUser(session?.user ?? null), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user || !profile?.profile_completed_at) return;
    const code = new URLSearchParams(window.location.search).get("invite");
    if (!code) return;
    window.history.replaceState({}, "", window.location.pathname);
    supabase.rpc("accept_invite", { invite_code: code }).then(({ error: inviteError }) => {
      if (inviteError) setError(inviteError.message);
      else window.location.reload();
    });
  }, [supabase, user, profile?.profile_completed_at]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    if (!supabase) { setError("Adiciona as credenciais do Supabase para ativar o login."); return; }
    setLoading(true);
    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      } else if (mode === "register") {
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (authError) throw authError;
        setMessage(data.session ? "Conta criada. Termina agora o teu perfil." : "Conta criada. Confirma o email para continuar.");
      } else {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback` });
        if (authError) throw authError;
        setMessage("Enviámos um link de recuperação para o teu email.");
      }
    } catch (authError) { setError(authError instanceof Error ? authError.message : "Não foi possível concluir o pedido."); }
    finally { setLoading(false); }
  }

  async function handleLogout() {
    if (!supabase) return;
    setLoading(true); await supabase.auth.signOut(); setLoading(false);
  }

  if (loading && user === null) return <main className="loading-screen"><LoaderCircle className="spin" aria-label="A carregar" /></main>;
  if (user && !profile?.profile_completed_at) return <CompleteProfile user={user} supabase={supabase!} onComplete={setProfile} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} />;
  if (user && profile) return <Dashboard profile={profile} email={user.email ?? ""} supabase={supabase!} onLogout={handleLogout} loading={loading} theme={theme} onToggleTheme={toggleTheme} />;

  return <main className="auth-shell">
    <section className="brand-panel"><div className="brand-content">
      <div className="brand-mark"><Home size={22} strokeWidth={2.4} /></div><p className="brand-name">HomeHQ</p>
      <div className="brand-message"><span className="eyebrow">A vossa casa, em sintonia</span><h1>Menos mensagens.<br />Mais casa.</h1><p>Compras, tarefas e despesas partilhadas num só lugar.</p></div>
      <div className="feature-row"><div><ShoppingBasket size={18} /><span>Compras</span></div><div><CheckCircle2 size={18} /><span>Tarefas</span></div><div><Users size={18} /><span>Despesas</span></div></div>
    </div></section>
    <section className="form-panel"><ThemeButton theme={theme} onToggle={toggleTheme} /><div className="form-wrap">
      {!isSupabaseConfigured && <div className="config-notice"><Settings2 size={18} /><div><strong>Falta ligar o Supabase</strong><span>O formulário está pronto para receber as credenciais.</span></div></div>}
      <div className="form-heading"><span className="mobile-brand"><Home size={18} /> HomeHQ</span><h2>{mode === "login" ? "Bem-vindo a casa" : mode === "register" ? "Cria a tua conta" : "Recuperar acesso"}</h2><p>{mode === "login" ? "Entra para veres o que se passa lá por casa." : mode === "register" ? "Começa a organizar a casa com os teus amigos." : "Recebe um link para definires uma nova palavra-passe."}</p></div>
      <form onSubmit={handleSubmit}>
        <label>Email<span className="input-wrap"><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@email.com" autoComplete="email" required /></span></label>
        {mode !== "forgot" && <label>Palavra-passe<span className="input-wrap"><LockKeyhole size={18} /><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 6 caracteres" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required /><button type="button" className="icon-button" onClick={() => setShowPassword((value) => !value)} aria-label="Mostrar palavra-passe">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>}
        {mode === "login" && <button type="button" className="text-button forgot" onClick={() => setMode("forgot")}>Esqueci-me da palavra-passe</button>}
        {error && <p className="feedback error">{error}</p>}{message && <p className="feedback success">{message}</p>}
        <button className="primary-button" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={19} /> : <>{mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : "Enviar link"}<ArrowRight size={18} /></>}</button>
      </form>
      <p className="switch-mode">{mode === "login" ? "Ainda não tens conta?" : "Já tens uma conta?"}<button className="text-button" onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Criar conta" : "Entrar"}</button></p>
    </div></section>
  </main>;
}
