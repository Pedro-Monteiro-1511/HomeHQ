"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Clock3, Copy, Home, KeyRound, Link2, ListChecks, LoaderCircle, Mail, Plus, QrCode, ReceiptText, Search, Settings2, ShoppingBasket, SlidersHorizontal, UserRound, Users, WalletCards, X } from "lucide-react";
import { daysInMonth, equalShares, formatMoney, formatTaskDate, getNextOccurrence, MONTHS, priorityLabel } from "@/lib/homehq-utils";
import type { ActivityLog, Bill, Debt, DebtAdjustment, EventTag, House, HouseEvent, HouseMember, HousePermissions, HouseSection, Invite, PendingInvite, PermissionLevel, PermissionSection, Profile, ShoppingItem, Task, Theme } from "@/types/homehq";

export function CreateBillPage({ house, members, supabase, onBack, onCreated }: { house: House; members: HouseMember[]; supabase: SupabaseClient; onBack: () => void; onCreated: () => void }) {
  const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [frequency, setFrequency] = useState(""); const [dueMonth, setDueMonth] = useState(""); const [dueDay, setDueDay] = useState(""); const [shares, setShares] = useState<Record<string, number>>({}); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const totalCents = Math.max(0, Math.round((Number(amount) || 0) * 100));

  useEffect(() => { setShares(equalShares(totalCents, members.map((member) => member.user_id))); }, [members.length, totalCents]);

  function changeShare(userId: string, nextValue: number) {
    const next = Math.max(0, Math.min(totalCents, nextValue));
    const otherIds = members.map((member) => member.user_id).filter((id) => id !== userId);
    const remainder = totalCents - next;
    const oldOtherTotal = otherIds.reduce((sum, id) => sum + (shares[id] ?? 0), 0);
    let allocated = 0; const updated = { ...shares, [userId]: next };
    otherIds.forEach((id, index) => {
      const value = index === otherIds.length - 1 ? remainder - allocated : Math.round(remainder * (oldOtherTotal > 0 ? (shares[id] ?? 0) / oldOtherTotal : 1 / otherIds.length));
      updated[id] = value; allocated += value;
    });
    setShares(updated);
  }

  async function createBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const payload = members.map((member) => ({ user_id: member.user_id, amount: (shares[member.user_id] / 100).toFixed(2) }));
    const nextDueDate = getNextOccurrence(Number(dueMonth), Number(dueDay));
    const { error: createError } = await supabase.rpc("create_house_bill", { target_house_id: house.id, bill_name: name, bill_amount: totalCents / 100, bill_frequency: frequency, bill_next_due_date: nextDueDate, shares: payload });
    if (createError) { setError(createError.message); setLoading(false); return; }
    await onCreated();
  }

  return <div className="create-bill-page"><button className="back-button" onClick={onBack}><ArrowLeft size={18} /> Contas</button><div className="house-page-heading"><div><span className="eyebrow">Nova conta</span><h1>Quem paga o quê?</h1><p>Altera uma divisão pelo slider ou escreve diretamente o valor.</p></div></div><form className="bill-form" onSubmit={createBill}><div className="bill-fields"><label>Nome da conta<span className="input-wrap"><ReceiptText size={18} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Renda" required /></span></label><label>Valor total<span className="input-wrap"><WalletCards size={18} /><input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" min="0.01" step="0.01" required /></span></label><label>Periodicidade<select value={frequency} onChange={(event) => setFrequency(event.target.value)} required><option value="" disabled>Periodicidade do pagamento</option><option value="monthly">Mensal</option><option value="weekly">Semanal</option><option value="yearly">Anual</option><option value="one_time">Pagamento único</option></select></label><fieldset className="month-day-field"><legend>Próximo pagamento</legend><select value={dueMonth} onChange={(event) => { setDueMonth(event.target.value); setDueDay(""); }} required><option value="" disabled>Mês</option>{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select><select value={dueDay} onChange={(event) => setDueDay(event.target.value)} required disabled={!dueMonth}><option value="" disabled>Dia</option>{Array.from({ length: daysInMonth(Number(dueMonth)) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></fieldset></div><div className="split-editor"><div className="split-heading"><strong>Divisão</strong><span>{formatMoney(totalCents, house.currency)}</span></div>{members.map((member) => <div className="member-split" key={member.user_id}><div className="member-line"><span className="member-avatar">{member.avatar_url ? <img src={member.avatar_url} alt="" /> : member.username.slice(0, 1).toUpperCase()}</span><strong>{member.username}</strong><input className="share-input" type="number" min="0" max={totalCents / 100} step="0.01" value={((shares[member.user_id] ?? 0) / 100).toFixed(2)} onChange={(event) => changeShare(member.user_id, Math.round(Number(event.target.value) * 100))} /></div><input type="range" min="0" max={totalCents} step="1" value={shares[member.user_id] ?? 0} onChange={(event) => changeShare(member.user_id, Number(event.target.value))} /></div>)}</div>{error && <p className="feedback error">{error}</p>}<button className="primary-button" disabled={loading || members.length === 0}>{loading ? <LoaderCircle className="spin" size={19} /> : <>Guardar conta<ArrowRight size={18} /></>}</button></form></div>;
}
