"use client";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { EventTag, House } from "@/types/homehq";

export function TagManager({ house, tags, supabase, onClose, onChanged }: { house: House; tags: EventTag[]; supabase: SupabaseClient; onClose: () => void; onChanged: () => void }) {
  const [name, setName] = useState(""); const [color, setColor] = useState("#4382df");
  const [editingId, setEditingId] = useState(""); const [editName, setEditName] = useState(""); const [editColor, setEditColor] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function createTag() {
    if (!name.trim()) return;
    setLoading(true); setError("");
    const { error: createError } = await supabase.rpc("create_event_tag", { target_house: house.id, tag_name: name, tag_color: color });
    if (createError) setError(createError.message); else { setName(""); await onChanged(); }
    setLoading(false);
  }
  async function updateTag() {
    setLoading(true); setError("");
    const { error: updateError } = await supabase.rpc("update_event_tag", { target_tag: editingId, tag_name: editName, tag_color: editColor });
    if (updateError) setError(updateError.message); else { setEditingId(""); await onChanged(); }
    setLoading(false);
  }
  async function deleteTag(id: string) {
    setLoading(true); setError("");
    const { error: deleteError } = await supabase.rpc("delete_event_tag", { target_tag: id });
    if (deleteError) setError(deleteError.message); else await onChanged();
    setLoading(false);
  }
  return <div className="modal-backdrop" onClick={onClose}><section className="tag-manager" onClick={(event) => event.stopPropagation()}><div className="tag-manager-heading"><div><span className="eyebrow">Organização</span><h2>Gerir tags</h2><p>Cada evento usa uma cor no calendário.</p></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div><div className="tag-manager-list">{tags.map((tag) => editingId === tag.id ? <article key={tag.id}><input value={editName} onChange={(event) => setEditName(event.target.value)} /><input type="color" value={editColor} onChange={(event) => setEditColor(event.target.value)} /><button className="icon-button" disabled={loading} onClick={() => void updateTag()} aria-label="Guardar"><Check size={17} /></button><button className="icon-button" onClick={() => setEditingId("")} aria-label="Cancelar"><X size={17} /></button></article> : <article key={tag.id}><i style={{ background: tag.color }} /><strong>{tag.name}</strong>{tag.is_default && <span>Predefinida</span>}<button className="icon-button" onClick={() => { setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color); }} aria-label={`Editar ${tag.name}`}><Pencil size={15} /></button><button className="icon-button danger" disabled={loading || tags.length === 1} onClick={() => void deleteTag(tag.id)} aria-label={`Apagar ${tag.name}`}><Trash2 size={15} /></button></article>)}</div><div className="tag-manager-create"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome da nova tag" maxLength={30} /><input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Cor da nova tag" /><button className="primary-button compact" disabled={loading || !name.trim()} onClick={() => void createTag()}><Plus size={16} /> Criar tag</button></div>{error && <p className="feedback error">{error}</p>}</section></div>;
}
