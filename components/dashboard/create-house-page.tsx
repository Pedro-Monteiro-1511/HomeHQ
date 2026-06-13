"use client";
import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowLeft, ArrowRight, Clock3, Home, LoaderCircle } from "lucide-react";

export function CreateHousePage({ supabase, onBack, onCreated }: { supabase: SupabaseClient; onBack: () => void; onCreated: () => void }) {
  const [name, setName] = useState(""); const [currency, setCurrency] = useState("EUR"); const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Lisbon"); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function createHouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const { error: createError } = await supabase.rpc("create_house", { house_name: name, house_currency: currency, house_timezone: timezone });
    if (createError) { setError(createError.message); setLoading(false); return; }
    await onCreated();
  }
  return <section className="create-house-page"><button className="back-button" onClick={onBack}><ArrowLeft size={18} /> Página inicial</button><div className="create-house-layout"><div><span className="eyebrow">Nova casa</span><h1>Cria o vosso espaço</h1><p>Estes dados definem como valores e horários aparecem para todos os membros.</p></div><form className="house-form" onSubmit={createHouse}><label>Nome da casa<span className="input-wrap"><Home size={18} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Casa da Rua Verde" maxLength={80} required /></span></label><label>Moeda<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="EUR">EUR · Euro</option><option value="GBP">GBP · Libra</option><option value="USD">USD · Dólar</option><option value="BRL">BRL · Real</option></select></label><label>Fuso horário<span className="input-wrap"><Clock3 size={18} /><input value={timezone} onChange={(event) => setTimezone(event.target.value)} required /></span></label>{error && <p className="feedback error">{error}</p>}<button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={19} /> : <>Criar casa<ArrowRight size={18} /></>}</button></form></div></section>;
}
