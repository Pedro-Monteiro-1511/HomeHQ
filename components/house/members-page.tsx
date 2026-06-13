"use client";
import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Clock3, Copy, Home, KeyRound, Link2, ListChecks, LoaderCircle, Mail, Plus, QrCode, ReceiptText, Search, Settings2, ShoppingBasket, SlidersHorizontal, UserRound, Users, WalletCards, X } from "lucide-react";
import type { ActivityLog, Bill, Debt, DebtAdjustment, EventTag, House, HouseEvent, HouseMember, HousePermissions, HouseSection, Invite, PendingInvite, PermissionLevel, PermissionSection, Profile, ShoppingItem, Task, Theme } from "@/types/homehq";

export function MembersPage({ house, members, invites, supabase, canEdit, onChanged }: { house: House; members: HouseMember[]; invites: Invite[]; supabase: SupabaseClient; canEdit: boolean; onChanged: () => void }) {
  const [kind, setKind] = useState<"email" | "qr">("email");
  const [email, setEmail] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [createdInvite, setCreatedInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inviteUrl = createdInvite ? `${window.location.origin}/?invite=${createdInvite.code}` : "";

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const { data, error: inviteError } = await supabase.rpc("create_house_invite", {
      target_house_id: house.id,
      invite_kind: kind,
      invite_email: kind === "email" ? email : null,
      invite_max_uses: kind === "qr" ? Number(maxUses) : null,
      invite_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
    if (inviteError) { setError(inviteError.message); setLoading(false); return; }
    setCreatedInvite(data as Invite); setLoading(false); await onChanged();
  }

  return <div className="members-page"><div className="house-page-heading"><div><span className="eyebrow">Pessoas</span><h1>Membros da casa</h1><p>{canEdit ? "Consulta os membros e cria convites seguros." : "Consulta os membros desta casa."}</p></div></div><div className="members-layout"><section className="dashboard-panel member-list-panel"><div className="panel-heading"><div><span>Membros atuais</span><strong>{members.length}</strong></div><Users size={20} /></div><div className="member-list">{members.map((member) => <article key={member.user_id}><span className="member-avatar">{member.avatar_url ? <img src={member.avatar_url} alt="" /> : member.username.slice(0, 1).toUpperCase()}</span><div><strong>{member.username}</strong><span>{member.role === "owner" ? "Proprietário" : member.role === "admin" ? "Administrador" : "Membro"}</span></div></article>)}</div></section>{canEdit && <section className="dashboard-panel invite-panel"><div className="invite-tabs"><button className={kind === "email" ? "active" : ""} onClick={() => { setKind("email"); setCreatedInvite(null); }}><Mail size={16} /> Email</button><button className={kind === "qr" ? "active" : ""} onClick={() => { setKind("qr"); setCreatedInvite(null); }}><QrCode size={16} /> QR code</button></div>{createdInvite ? <div className="created-invite"><div className="qr-wrap">{kind === "qr" ? <QRCodeSVG value={inviteUrl} size={180} bgColor="transparent" fgColor="currentColor" /> : <Link2 size={38} />}</div><strong>Convite criado</strong><p>{kind === "email" ? `Apenas ${createdInvite.recipient_email} pode utilizar este link.` : `Este QR code permite até ${createdInvite.max_uses} entradas.`}</p><button className="primary-button" onClick={() => navigator.clipboard.writeText(inviteUrl)}><Copy size={17} /> Copiar link</button><button className="text-button" onClick={() => setCreatedInvite(null)}>Criar outro convite</button></div> : <form className="invite-form" onSubmit={createInvite}><div className="form-heading"><h2>{kind === "email" ? "Convidar por email" : "Criar QR code"}</h2><p>{kind === "email" ? "O link só funcionará para o email indicado." : "Define quantas pessoas podem utilizar este QR code."}</p></div>{kind === "email" ? <label>Email do convidado<span className="input-wrap"><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="amigo@email.com" required /></span></label> : <label>Limite de pessoas<input className="plain-input" type="number" value={maxUses} onChange={(event) => setMaxUses(event.target.value)} min="1" max="100" required /></label>}<label>Validade do convite<input className="plain-input" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>{error && <p className="feedback error">{error}</p>}<button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={18} /> : <>{kind === "email" ? "Criar convite" : "Gerar QR code"}<ArrowRight size={17} /></>}</button></form>}<div className="invite-history"><strong>Convites ativos</strong>{invites.slice(0, 4).map((invite) => <div key={invite.id}><span>{invite.type === "email" ? invite.recipient_email : `QR · ${invite.used_count}/${invite.max_uses}`}</span><button className="icon-button" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/?invite=${invite.code}`)} aria-label="Copiar link"><Copy size={15} /></button></div>)}</div></section>}</div></div>;
}
