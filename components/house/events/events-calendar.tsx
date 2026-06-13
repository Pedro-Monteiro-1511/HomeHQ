"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EventTags, eventDateLabel, localDate } from "@/components/house/events/event-utils";
import type { HouseEvent } from "@/types/homehq";

export function EventsCalendar({ events, expanded = false, onOpen }: { events: HouseEvent[]; expanded?: boolean; onOpen?: () => void }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const futureEvents = useMemo(() => events.filter((event) => localDate(event.end_date) >= new Date(new Date().setHours(0, 0, 0, 0))), [events]);
  const firstOffset = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstOffset + days }, (_, index) => index < firstOffset ? null : index - firstOffset + 1);
  const upcoming = futureEvents.slice(0, expanded ? futureEvents.length : 3);

  return <section className={`dashboard-panel events-calendar ${expanded ? "expanded" : ""}`}>
    <div className="calendar-toolbar"><div><span>Calendário</span><strong>{new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(month)}</strong></div><div><button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Mês anterior"><ChevronLeft size={17} /></button><button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Mês seguinte"><ChevronRight size={17} /></button></div></div>
    <div className="calendar-weekdays">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid">{cells.map((day, index) => {
      if (!day) return <span className="calendar-day empty" key={`empty-${index}`} />;
      const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayEvents = futureEvents.filter((event) => event.start_date <= date && event.end_date >= date);
      return <span className={`calendar-day ${dayEvents.length ? "has-events" : ""}`} key={date}><b>{day}</b><i>{dayEvents.slice(0, 3).map((event) => <em key={event.id} title={event.title} style={{ background: event.house_event_tag_links[0]?.event_tags?.color ?? "var(--green)" }} />)}</i></span>;
    })}</div>
    <div className="upcoming-events"><div className="upcoming-title"><strong>Próximos eventos</strong><span>{futureEvents.length}</span></div>{upcoming.length === 0 ? <p>Não existem eventos futuros.</p> : upcoming.map((event) => <article key={event.id}><span className="event-date-tile"><b>{localDate(event.start_date).getDate()}</b><small>{new Intl.DateTimeFormat("pt-PT", { month: "short" }).format(localDate(event.start_date))}</small></span><div><strong>{event.title}</strong><span>{eventDateLabel(event)}</span><EventTags event={event} /></div></article>)}</div>
    {!expanded && <button className="panel-more" onClick={onOpen}>Ver mais <ChevronRight size={14} /></button>}
  </section>;
}
