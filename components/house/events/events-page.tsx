"use client";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Plus, Settings2 } from "lucide-react";
import { EventsCalendar } from "@/components/house/events/events-calendar";
import { TagManager } from "@/components/house/events/tag-manager";
import type { EventTag, House, HouseEvent } from "@/types/homehq";

export function EventsPage({ house, events, tags, supabase, canEdit, onCreate, onChanged }: { house: House; events: HouseEvent[]; tags: EventTag[]; supabase: SupabaseClient; canEdit: boolean; onCreate: () => void; onChanged: () => void }) {
  const [managingTags, setManagingTags] = useState(false);
  return <div className="events-page"><div className="house-page-heading"><div><span className="eyebrow">Agenda partilhada</span><h1>Eventos</h1><p>Datas importantes e planos da casa.</p></div>{canEdit && <div className="event-page-actions"><button className="secondary-button compact" onClick={() => setManagingTags(true)}><Settings2 size={17} /> Gerir tags</button><button className="primary-button compact" onClick={onCreate}><Plus size={18} /> Novo evento</button></div>}</div><EventsCalendar events={events} expanded />{managingTags && <TagManager house={house} tags={tags} supabase={supabase} onClose={() => setManagingTags(false)} onChanged={onChanged} />}</div>;
}
