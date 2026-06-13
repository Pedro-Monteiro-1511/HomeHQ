import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Bell, CheckCircle2, ChevronRight, History, ListChecks, ReceiptText, ShoppingBasket } from "lucide-react";
import { formatDate, formatTaskDate, frequencyLabel, priorityLabel, priorityRank } from "@/lib/homehq-utils";
import type { ActivityLog, Bill, HouseMember, ShoppingItem, Task } from "@/types/homehq";

export function ShoppingSummary({ items, onOpen }: { items: ShoppingItem[]; onOpen: () => void }) {
  const sorted = [...items].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority)).slice(0, 3);
  return <div className="dashboard-panel dashboard-link" onClick={onOpen} role="button" tabIndex={0}><div className="panel-heading"><div><span>Compras prioritárias</span><strong>{items.length}<small> pendentes</small></strong></div><ShoppingBasket size={20} /></div><div className="mini-list">{sorted.map((item) => <div key={item.id}><span className={`priority-dot ${item.priority}`} /><strong>{item.name}</strong><span>{priorityLabel(item.priority)}</span></div>)}</div><button className="panel-more">Ver mais <ChevronRight size={14} /></button></div>;
}

export function LogsPanel({ logs, members }: { logs: ActivityLog[]; members: HouseMember[] }) {
  return <div className="dashboard-panel"><div className="panel-heading"><div><span>Atividade recente</span><strong>{logs.length}<small> registos</small></strong></div><History size={20} /></div><div className="logs-list">{logs.map((log) => <div key={log.id}><span>{members.find((member) => member.user_id === log.actor_id)?.username ?? "Sistema"} · {log.description}</span><time>{new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" }).format(new Date(log.created_at))}</time></div>)}</div></div>;
}

export function BillsPanel({ bills, members, currency, expanded, onOpen }: { bills: Bill[]; members: HouseMember[]; currency: string; expanded: boolean; onOpen: () => void }) {
  const format = (value: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(value);
  const total = bills.reduce((sum, bill) => sum + Number(bill.amount), 0);
  const visibleBills = expanded ? bills : bills.slice(0, 3);
  return <div className={`dashboard-panel bills-panel ${expanded ? "expanded" : "dashboard-link"}`} onClick={expanded ? undefined : onOpen} role={expanded ? undefined : "button"} tabIndex={expanded ? undefined : 0}><div className="panel-heading"><div><span>Contas da casa</span><strong>{format(total)}<small>/mês</small></strong></div><ReceiptText size={20} /></div>
    {bills.length === 0 ? <div className="panel-empty"><p>Ainda não existem contas nesta casa.</p></div>
      : <div className="bill-list">{visibleBills.map((bill) => <article className="bill-row" key={bill.id}><div><strong>{bill.name}</strong><span>{frequencyLabel(bill.frequency)}{bill.next_due_date ? ` · ${formatDate(bill.next_due_date)}` : ""}</span></div><div className="bill-people">{bill.house_bill_shares.slice(0, 3).map((share) => <span title={`${members.find((member) => member.user_id === share.user_id)?.username}: ${format(Number(share.amount))}`} key={share.user_id}>{members.find((member) => member.user_id === share.user_id)?.username?.slice(0, 1).toUpperCase() ?? "M"}</span>)}</div><strong>{format(Number(bill.amount))}</strong></article>)}</div>}
    {!expanded && <button className="panel-more" onClick={(event) => { event.stopPropagation(); onOpen(); }}>Ver mais <ChevronRight size={14} /></button>}
  </div>;
}

export function TasksPanel({ tasks, members, expanded, onOpen, supabase, onChanged }: { tasks: Task[]; members: HouseMember[]; expanded: boolean; onOpen: () => void; supabase: SupabaseClient; canEdit: boolean; onChanged: () => void }) {
  const visibleTasks = expanded ? tasks : tasks.slice(0, 3);
  const [completionNotifications, setCompletionNotifications] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!expanded) return;
    supabase.from("house_task_notification_preferences").select("task_id, notify_on_completion").then(({ data }) => setCompletionNotifications(Object.fromEntries((data ?? []).map((item) => [item.task_id, item.notify_on_completion]))));
  }, [expanded, tasks.length, supabase]);
  async function complete(taskId: string) { await supabase.rpc("complete_house_task", { target_task_id: taskId }); await onChanged(); }
  async function toggleCompletionNotification(taskId: string, enabled: boolean) {
    const { data } = await supabase.auth.getUser(); if (!data.user) return;
    await supabase.from("house_task_notification_preferences").upsert({ task_id: taskId, user_id: data.user.id, notify_on_completion: enabled });
    setCompletionNotifications((current) => ({ ...current, [taskId]: enabled }));
  }
  return <div className={`dashboard-panel tasks-panel ${expanded ? "expanded" : "dashboard-link"}`} onClick={expanded ? undefined : onOpen} role={expanded ? undefined : "button"} tabIndex={expanded ? undefined : 0}><div className="panel-heading"><div><span>Próximas tarefas</span><strong>{tasks.length}<small> pendentes</small></strong></div><ListChecks size={20} /></div>
    {tasks.length === 0 ? <div className="panel-empty"><p>Não existem tarefas pendentes.</p></div> : <div className="task-list">{visibleTasks.map((task) => <article className="task-row" key={task.id}><button className="task-check" onClick={(event) => { event.stopPropagation(); void complete(task.id); }} aria-label="Concluir tarefa"><CheckCircle2 size={19} /></button><div><strong>{task.title}</strong><span>{frequencyLabel(task.frequency)} · {formatTaskDate(task.next_due_at)}</span></div><div className="bill-people">{task.house_task_assignees.slice(0, 3).map((assignee) => <span key={assignee.user_id}>{members.find((member) => member.user_id === assignee.user_id)?.username?.slice(0, 1).toUpperCase() ?? "M"}</span>)}</div>{expanded && <label className="notification-toggle" title="Notificar-me quando concluída"><Bell size={15} /><input type="checkbox" checked={completionNotifications[task.id] ?? false} onChange={(event) => void toggleCompletionNotification(task.id, event.target.checked)} /></label>}</article>)}</div>}
    {!expanded && <button className="panel-more" onClick={(event) => { event.stopPropagation(); onOpen(); }}>Ver mais <ChevronRight size={14} /></button>}
  </div>;
}
