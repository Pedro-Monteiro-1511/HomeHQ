"use client";
import { useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Clock3, Copy, Home, KeyRound, Link2, ListChecks, LoaderCircle, Mail, Plus, QrCode, ReceiptText, Search, Settings2, ShoppingBasket, SlidersHorizontal, UserRound, Users, WalletCards, X } from "lucide-react";
import { formatMoney } from "@/lib/homehq-utils";
import type { ActivityLog, Bill, Debt, DebtAdjustment, EventTag, House, HouseEvent, HouseMember, HousePermissions, HouseSection, Invite, PendingInvite, PermissionLevel, PermissionSection, Profile, ShoppingItem, Task, Theme } from "@/types/homehq";

export function FinancePage({ house, members, debts, adjustments, supabase, canEdit, onChanged }: { house: House; members: HouseMember[]; debts: Debt[]; adjustments: DebtAdjustment[]; supabase: SupabaseClient; canEdit: boolean; onChanged: () => void }) {
  const [detail, setDetail] = useState<Debt | null>(null);
  const [adjusting, setAdjusting] = useState(false); const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const nameOf = (id: string) => members.find((member) => member.user_id === id)?.username ?? "Membro";
  function toggleUser(id: string) { setSelectedUsers((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  async function adjust() {
    setLoading(true); setError("");
    const { error: adjustError } = await supabase.rpc("create_general_debt_adjustment", { target_house: house.id, selected_users: selectedUsers });
    if (adjustError) { setError(adjustError.message); setLoading(false); return; }
    setAdjusting(false); setSelectedUsers([]); setLoading(false); await onChanged();
  }
  function detailItems(item: Debt) {
    if (item.source_type !== "general_adjustment" || !item.source_id) return [{ description: item.description, amount: Number(item.amount), debtor_id: item.debtor_id, creditor_id: item.creditor_id }];
    const adjustment = adjustments.find((entry) => entry.id === item.source_id);
    return adjustment?.original_debts.map((original) => ({ description: `Ajuste geral: ${original.description}`, amount: Number(original.amount), debtor_id: original.debtor_id, creditor_id: original.creditor_id })) ?? [{ description: "Ajuste geral", amount: Number(item.amount), debtor_id: item.debtor_id, creditor_id: item.creditor_id }];
  }
  return <div className="finance-page"><div className="house-page-heading"><div><span className="eyebrow">Gestão de €</span><h1>Quem deve a quem</h1><p>Cada movimento permanece separado até fazeres um ajuste geral.</p></div>{canEdit && <button className="primary-button compact" onClick={() => setAdjusting(true)}><SlidersHorizontal size={17} /> Ajuste geral</button>}</div>{error && <p className="feedback error">{error}</p>}<section className="dashboard-panel debt-list">{debts.length === 0 ? <div className="panel-empty"><p>Não existem dívidas pendentes.</p></div> : debts.map((debt) => <article key={debt.id}><span className="member-avatar">{nameOf(debt.debtor_id).slice(0, 1).toUpperCase()}</span><div><strong>{nameOf(debt.debtor_id)} deve a {nameOf(debt.creditor_id)}</strong><span>{debt.description}</span></div><strong>{formatMoney(Math.round(Number(debt.amount) * 100), house.currency)}</strong><button className="icon-button debt-search" onClick={() => setDetail(debt)} aria-label="Ver detalhes"><Search size={17} /></button></article>)}</section>
    {detail && <div className="modal-backdrop" onClick={() => setDetail(null)}><section className="debt-detail-modal" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">Detalhes do saldo</span><h2>{nameOf(detail.debtor_id)} deve a {nameOf(detail.creditor_id)}</h2><p>{formatMoney(Math.round(Number(detail.amount) * 100), house.currency)}</p></div><button className="icon-button" onClick={() => setDetail(null)}><X size={18} /></button></div><div className="debt-detail-list">{detailItems(detail).map((item, index) => <article key={`${item.description}-${index}`}><div><strong>{item.description}</strong><span>{nameOf(item.debtor_id)} → {nameOf(item.creditor_id)}</span></div><strong>{formatMoney(Math.round(item.amount * 100), house.currency)}</strong></article>)}</div></section></div>}
    {adjusting && <div className="modal-backdrop" onClick={() => setAdjusting(false)}><section className="general-adjustment-modal" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">Consolidar saldos</span><h2>Ajuste geral</h2><p>Seleciona apenas os membros cujas dívidas internas devem ser simplificadas.</p></div><button className="icon-button" onClick={() => setAdjusting(false)}><X size={18} /></button></div><div className="adjustment-members">{members.map((member) => <button className={selectedUsers.includes(member.user_id) ? "selected" : ""} key={member.user_id} onClick={() => toggleUser(member.user_id)}><span className="member-avatar">{member.username.slice(0, 1).toUpperCase()}</span><strong>{member.username}</strong>{selectedUsers.includes(member.user_id) && <CheckCircle2 size={17} />}</button>)}</div><p className="adjustment-note">Dívidas com membros não selecionados não serão alteradas.</p>{error && <p className="feedback error">{error}</p>}<button className="primary-button" disabled={loading || selectedUsers.length < 2} onClick={() => void adjust()}>{loading ? <LoaderCircle className="spin" size={18} /> : <>Fazer ajuste geral<ArrowRight size={17} /></>}</button></section></div>}
  </div>;
}
