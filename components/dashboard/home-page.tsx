"use client";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ChevronRight, Clock3, Home, LoaderCircle, Mail, Plus, WalletCards } from "lucide-react";
import { formatTaskDate } from "@/lib/homehq-utils";
import type { House, PendingInvite, Profile } from "@/types/homehq";

export function HomePage({ profile, email, houses, pendingInvites, supabase, loading, onInvitesChanged, onCreate, onOpen }: { profile: Profile; email: string; houses: House[]; pendingInvites: PendingInvite[]; supabase: SupabaseClient; loading: boolean; onInvitesChanged: () => void; onCreate: () => void; onOpen: (house: House) => void }) {
  const [inviteError, setInviteError] = useState("");
  async function respondToInvite(code: string, accept: boolean) {
    setInviteError("");
    const { error } = await supabase.rpc(accept ? "accept_invite" : "reject_invite", { invite_code: code });
    if (error) { setInviteError(error.message); return; }
    await onInvitesChanged();
  }
  return <><section className="welcome welcome-row"><div><span className="eyebrow">Página inicial</span><h1>Olá, {profile.username ?? email.split("@")[0]}</h1><p>Vê e gere tudo o que se passa lá por casa.</p></div><button className="primary-button compact" onClick={onCreate}><Plus size={18} /> Criar casa</button></section>
    {pendingInvites.length > 0 && <section className="pending-invites"><div className="section-heading"><div><span className="eyebrow">Convites pendentes</span><h2>Queres juntar-te?</h2></div><Mail size={20} /></div>{inviteError && <p className="feedback error">{inviteError}</p>}<div>{pendingInvites.map((invite) => <article key={invite.id}><div className="house-card-icon"><Home size={19} /></div><div><strong>{invite.house_name}</strong><span>{invite.expires_at ? `Válido até ${formatTaskDate(invite.expires_at)}` : "Sem data de expiração"}</span></div><button className="secondary-button" onClick={() => void respondToInvite(invite.code, false)}>Recusar</button><button className="primary-button compact" onClick={() => void respondToInvite(invite.code, true)}>Aceitar</button></article>)}</div></section>}
    {loading ? <section className="empty-state"><LoaderCircle className="spin" /></section> : houses.length === 0 ? <section className="empty-state"><div className="spark"><Home size={22} /></div><h2>Cria a tua primeira casa</h2><p>Depois podes convidar amigos e começar a organizar compras, tarefas e despesas.</p><button className="primary-button" onClick={onCreate}><Plus size={18} /> Criar casa</button></section>
      : <section className="house-grid">{houses.map((house) => <button className="house-card" key={house.id} onClick={() => onOpen(house)}><div className="house-card-icon"><Home size={20} /></div><div><h2>{house.name}</h2><p><WalletCards size={14} /> {house.currency} <span>·</span> <Clock3 size={14} /> {house.timezone}</p></div><ChevronRight size={18} /></button>)}</section>}
  </>;
}
