"use client";
import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Clock3, Copy, Home, KeyRound, Link2, ListChecks, LoaderCircle, Mail, Plus, QrCode, ReceiptText, Search, Settings2, ShoppingBasket, SlidersHorizontal, UserRound, Users, WalletCards, X } from "lucide-react";
import { daysInMonth, equalShares, formatMoney, formatTaskDate, getNextOccurrence, MONTHS, priorityLabel } from "@/lib/homehq-utils";
import type { ActivityLog, Bill, Debt, DebtAdjustment, EventTag, House, HouseEvent, HouseMember, HousePermissions, HouseSection, Invite, PendingInvite, PermissionLevel, PermissionSection, Profile, ShoppingItem, Task, Theme } from "@/types/homehq";

export function ShoppingPage({ house, members, items, supabase, canEdit, onChanged }: { house: House; members: HouseMember[]; items: ShoppingItem[]; supabase: SupabaseClient; canEdit: boolean; onChanged: () => void }) {
  const [name, setName] = useState(""); const [priority, setPriority] = useState<ShoppingItem["priority"]>("normal"); const [scope, setScope] = useState<"house" | "personal">("house"); const [personalFor, setPersonalFor] = useState(members[0]?.user_id ?? ""); const [purchaseItem, setPurchaseItem] = useState<ShoppingItem | null>(null); const [purchasePrice, setPurchasePrice] = useState(""); const [buyerId, setBuyerId] = useState(""); const [participants, setParticipants] = useState<string[]>([]); const [purchaseShares, setPurchaseShares] = useState<Record<string, number>>({}); const [error, setError] = useState("");
  async function openPurchase(item: ShoppingItem) {
    const { data } = await supabase.auth.getUser();
    const selected = item.scope === "personal" && item.personal_for ? [item.personal_for] : members.map((member) => member.user_id);
    setPurchaseItem(item); setPurchasePrice(""); setBuyerId(data.user?.id ?? members[0]?.user_id ?? ""); setParticipants(selected); setPurchaseShares(equalShares(0, selected));
  }
  async function createItem(markPurchased: boolean) {
    setError("");
    if (!name.trim()) { setError("Indica o nome do item."); return; }
    const { data, error: addError } = await supabase.rpc("add_shopping_item", { target_house: house.id, item_name: name, item_priority: priority, item_scope: scope, item_personal_for: scope === "personal" ? personalFor : null, item_estimated_price: null });
    if (addError) { setError(addError.message); return; }
    setName(""); await onChanged();
    if (markPurchased) await openPurchase(data as ShoppingItem);
  }
  function updatePurchaseTotal(value: string) {
    setPurchasePrice(value);
    setPurchaseShares(equalShares(Math.round((Number(value) || 0) * 100), participants));
  }
  function toggleParticipant(id: string) {
    const next = participants.includes(id) ? participants.filter((item) => item !== id) : [...participants, id];
    if (!next.length) return;
    setParticipants(next); setPurchaseShares(equalShares(Math.round((Number(purchasePrice) || 0) * 100), next));
  }
  function changePurchaseShare(userId: string, value: number) {
    const total = Math.round((Number(purchasePrice) || 0) * 100);
    const next = Math.max(0, Math.min(total, value)); const others = participants.filter((id) => id !== userId); const remainder = total - next;
    const updated = { ...purchaseShares, [userId]: next }; const oldTotal = others.reduce((sum, id) => sum + (purchaseShares[id] ?? 0), 0); let allocated = 0;
    others.forEach((id, index) => { const amount = index === others.length - 1 ? remainder - allocated : Math.round(remainder * (oldTotal ? (purchaseShares[id] ?? 0) / oldTotal : 1 / others.length)); updated[id] = amount; allocated += amount; });
    setPurchaseShares(updated);
  }
  async function purchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!purchaseItem) return;
    const shares = participants.map((id) => ({ user_id: id, amount: ((purchaseShares[id] ?? 0) / 100).toFixed(2) }));
    const { error: purchaseError } = await supabase.rpc("confirm_shopping_purchase", { target_item: purchaseItem.id, final_price: Number(purchasePrice), buyer_id: buyerId, shares });
    if (purchaseError) { setError(purchaseError.message); return; }
    setPurchaseItem(null); setPurchasePrice("");
    await onChanged();
  }
  return <div className="shopping-page"><div className="house-page-heading"><div><span className="eyebrow">Lista partilhada</span><h1>Compras</h1><p>Itens para a casa ou pedidos pessoais.</p></div></div>{canEdit && <div className="shopping-inline"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Adicionar item..." /><select value={priority} onChange={(event) => setPriority(event.target.value as ShoppingItem["priority"])}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select><select value={scope} onChange={(event) => setScope(event.target.value as "house" | "personal")}><option value="house">Para a casa</option><option value="personal">Pessoal</option></select>{scope === "personal" && <select value={personalFor} onChange={(event) => setPersonalFor(event.target.value)}>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.username}</option>)}</select>}<button className="secondary-button" onClick={() => void createItem(true)}><CheckCircle2 size={16} /> Já comprei</button><button className="primary-button compact" onClick={() => void createItem(false)}><Plus size={17} /> Adicionar</button></div>}{error && <p className="feedback error house-load-error">{error}</p>}<section className="dashboard-panel shopping-list">{items.map((item) => <article key={item.id}><button className="shopping-check" disabled={!canEdit} onClick={() => void openPurchase(item)} aria-label="Marcar como comprado"><CheckCircle2 size={19} /></button><span className={`priority-dot ${item.priority}`} /><div><strong>{item.name}</strong><span>{item.scope === "house" ? "Para a casa" : `Pessoal · ${members.find((member) => member.user_id === item.personal_for)?.username ?? "Membro"}`}</span></div><span className="priority-label">{priorityLabel(item.priority)}</span></article>)}</section>{purchaseItem && <div className="modal-backdrop" onClick={() => setPurchaseItem(null)}><form className="purchase-modal purchase-split-modal" onSubmit={purchase} onClick={(event) => event.stopPropagation()}><div className="modal-icon"><ShoppingBasket size={22} /></div><div className="form-heading"><h2>Confirmar compra</h2><p>Regista quem comprou, o preço e quem participa na divisão de “{purchaseItem.name}”.</p></div><div className="purchase-basics"><label>Quem comprou<select value={buyerId} onChange={(event) => setBuyerId(event.target.value)} required>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.username}</option>)}</select></label><label>Preço final<span className="input-wrap"><WalletCards size={18} /><input type="number" value={purchasePrice} onChange={(event) => updatePurchaseTotal(event.target.value)} placeholder="0,00" min="0.01" step="0.01" autoFocus required /></span></label></div><div className="purchase-participants"><strong>Participantes</strong>{members.map((member) => <div className={participants.includes(member.user_id) ? "" : "excluded"} key={member.user_id}><button type="button" className="participant-toggle" onClick={() => toggleParticipant(member.user_id)}>{participants.includes(member.user_id) ? <X size={14} /> : <Plus size={14} />}</button><span className="member-avatar">{member.username.slice(0,1).toUpperCase()}</span><strong>{member.username}</strong>{participants.includes(member.user_id) && <><input className="share-input" type="number" min="0" max={Number(purchasePrice) || 0} step="0.01" value={((purchaseShares[member.user_id] ?? 0)/100).toFixed(2)} onChange={(event) => changePurchaseShare(member.user_id, Math.round(Number(event.target.value)*100))}/><input type="range" min="0" max={Math.round((Number(purchasePrice)||0)*100)} value={purchaseShares[member.user_id] ?? 0} onChange={(event) => changePurchaseShare(member.user_id, Number(event.target.value))}/></>}</div>)}</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setPurchaseItem(null)}>Cancelar</button><button className="primary-button"><CheckCircle2 size={17} /> Confirmar compra</button></div></form></div>}</div>;
}
