"use client";
import { useState, type ChangeEvent, type FormEvent } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ArrowRight, Camera, LoaderCircle, UserRound } from "lucide-react";
import { AppHeader } from "@/components/shared/app-header";
import type { Profile, Theme } from "@/types/homehq";

export function CompleteProfile({ user, supabase, onComplete, onLogout, theme, onToggleTheme }: { user: User; supabase: SupabaseClient; onComplete: (profile: Profile) => void; onLogout: () => void; theme: Theme; onToggleTheme: () => void }) {
  const [username, setUsername] = useState(""); const [gender, setGender] = useState(""); const [avatar, setAvatar] = useState<File | null>(null); const [preview, setPreview] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  function selectAvatar(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0] ?? null; setAvatar(file); setPreview(file ? URL.createObjectURL(file) : ""); }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      let avatarUrl: string | null = null;
      if (avatar) {
        const path = `${user.id}/profile.${avatar.name.split(".").pop()?.toLowerCase() || "jpg"}`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(path, avatar, { upsert: true });
        if (uploadError) throw uploadError;
        avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      const { data, error: updateError } = await supabase.from("profiles").update({ username, gender, avatar_url: avatarUrl }).eq("id", user.id).select("username, gender, avatar_url, profile_completed_at, created_at").single();
      if (updateError) throw updateError; onComplete(data);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar o perfil."); } finally { setLoading(false); }
  }
  return <main className="onboarding-shell"><AppHeader theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout} /><section className="onboarding-panel">
    <div className="form-heading"><span className="eyebrow">Último passo</span><h2>Completa o teu perfil</h2><p>Estes dados ajudam as pessoas da tua casa a reconhecer-te.</p></div>
    <form onSubmit={saveProfile}><label className="avatar-picker"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectAvatar} /><span className="avatar-preview">{preview ? <img src={preview} alt="" /> : <UserRound size={30} />}</span><span><strong>Foto de perfil</strong><small>Opcional · JPG, PNG ou WebP</small></span><Camera size={18} /></label>
      <label>Username<span className="input-wrap"><UserRound size={18} /><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Como queres ser conhecido?" minLength={3} maxLength={30} pattern="[A-Za-z0-9_.-]+" required /></span></label>
      <label>Género<select value={gender} onChange={(event) => setGender(event.target.value)} required><option value="" disabled>Seleciona uma opção</option><option value="female">Feminino</option><option value="male">Masculino</option><option value="non_binary">Não binário</option><option value="prefer_not_to_say">Prefiro não dizer</option></select></label>
      {error && <p className="feedback error">{error}</p>}<button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={19} /> : <>Terminar registo<ArrowRight size={18} /></>}</button>
    </form>
  </section></main>;
}
