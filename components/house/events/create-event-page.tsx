"use client";
import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Tag } from "lucide-react";
import type { EventTag, House } from "@/types/homehq";

export function CreateEventPage({ house, tags, supabase, onBack, onCreated }: { house: House; tags: EventTag[]; supabase: SupabaseClient; onBack: () => void; onCreated: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(today); const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState(""); const [endTime, setEndTime] = useState("");
  const [selectedTagId, setSelectedTagId] = useState(() => tags.find((tag) => tag.is_default)?.id ?? tags[0]?.id ?? "");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const { error: createError } = await supabase.rpc("create_house_event", { target_house: house.id, event_title: title, event_description: description, event_start_date: startDate, event_end_date: endDate, event_start_time: startTime || null, event_end_time: endTime || null, tags: [{ id: selectedTagId }] });
    if (createError) { setError(createError.message); setLoading(false); return; }
    await onCreated();
  }

  return <div className="create-event-page"><button className="back-button" onClick={onBack}><ArrowLeft size={18} /> Eventos</button><div className="house-page-heading"><div><span className="eyebrow">Novo evento</span><h1>Marcar no calendário</h1><p>Escolhe o intervalo de datas e, se necessário, as horas.</p></div></div><form className="event-form" onSubmit={createEvent}><label>Título<span className="input-wrap"><CalendarDays size={18} /><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Fim de semana no Porto" required /></span></label><label>Descrição<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Detalhes opcionais..." /></label><fieldset className="date-range-picker"><legend>Datas do evento</legend><label><span>Início</span><input type="date" min={today} value={startDate} onChange={(event) => { setStartDate(event.target.value); if (event.target.value > endDate) setEndDate(event.target.value); }} required /></label><ArrowRight size={18} /><label><span>Fim</span><input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></label></fieldset><fieldset className="optional-times"><legend><Clock3 size={16} /> Horas <small>Opcional</small></legend><label>Hora de início<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label>Hora de fim<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label></fieldset><label>Tag<span className="tag-select-wrap"><Tag size={17} /><select value={selectedTagId} onChange={(event) => setSelectedTagId(event.target.value)} required>{tags.map((tag) => <option value={tag.id} key={tag.id}>{tag.name}</option>)}</select><i style={{ background: tags.find((tag) => tag.id === selectedTagId)?.color ?? "#8b9490" }} /></span></label>{error && <p className="feedback error">{error}</p>}<button className="primary-button" disabled={loading || !selectedTagId}>{loading ? "A guardar..." : <>Guardar evento<ArrowRight size={18} /></>}</button></form></div>;
}
