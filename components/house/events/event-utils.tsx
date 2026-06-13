import type { HouseEvent } from "@/types/homehq";

export function localDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

export function eventDateLabel(event: HouseEvent) {
  const formatter = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short" });
  const start = formatter.format(localDate(event.start_date));
  const end = formatter.format(localDate(event.end_date));
  const range = event.start_date === event.end_date ? start : `${start} - ${end}`;
  const times = event.start_time ? ` · ${event.start_time.slice(0, 5)}${event.end_time ? ` - ${event.end_time.slice(0, 5)}` : ""}` : "";
  return `${range}${times}`;
}

export function EventTags({ event }: { event: HouseEvent }) {
  return <div className="event-tags">{event.house_event_tag_links.map(({ event_tags: tag }) => tag && <span key={tag.id} style={{ "--tag-color": tag.color } as React.CSSProperties}>{tag.name}</span>)}</div>;
}
