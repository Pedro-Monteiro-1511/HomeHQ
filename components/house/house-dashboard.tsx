"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LoaderCircle, Plus } from "lucide-react";
import { HouseSidebar } from "@/components/house/house-sidebar";
import { BillsPanel, LogsPanel, ShoppingSummary, TasksPanel } from "@/components/house/dashboard-panels";
import { CreateEventPage } from "@/components/house/events/create-event-page";
import { EventsCalendar } from "@/components/house/events/events-calendar";
import { EventsPage } from "@/components/house/events/events-page";
import { MembersPage } from "@/components/house/members-page";
import { ShoppingPage } from "@/components/house/shopping-page";
import { FinancePage } from "@/components/house/finance-page";
import { HouseSettingsPage } from "@/components/house/settings-page";
import { PermissionsPage } from "@/components/house/permissions-page";
import { CreateTaskPage } from "@/components/house/create-task-page";
import { CreateBillPage } from "@/components/house/create-bill-page";
import type { ActivityLog, Bill, Debt, DebtAdjustment, EventTag, House, HouseEvent, HouseMember, HousePermissions, HouseSection, Invite, PendingInvite, PermissionLevel, PermissionSection, Profile, ShoppingItem, Task, Theme } from "@/types/homehq";

export function HouseDashboard({ house, profile, supabase, menuOpen, onCloseMenu, onBack }: { house: House; profile: Profile; supabase: SupabaseClient; menuOpen: boolean; onCloseMenu: () => void; onBack: () => void }) {
  const [section, setSection] = useState<HouseSection>("dashboard");
  const [members, setMembers] = useState<HouseMember[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<HouseEvent[]>([]);
  const [eventTags, setEventTags] = useState<EventTag[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [permissions, setPermissions] = useState<HousePermissions>({ dashboard: "view", events: "view", bills: "view", tasks: "view", members: "view", permissions: "none", shopping: "view", finance: "view" });
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtAdjustments, setDebtAdjustments] = useState<DebtAdjustment[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function loadHouseData() {
    setLoading(true); setLoadError("");
    const [{ data: membershipData, error: membershipError }, { data: billData, error: billError }, { data: taskData, error: taskError }, { data: eventData }, { data: eventTagData }, { data: inviteData }, { data: permissionData }, { data: shoppingData }, { data: debtData }, { data: adjustmentData }, { data: logData }] = await Promise.all([
      supabase.from("house_members").select("user_id, role").eq("house_id", house.id),
      supabase.from("house_bills").select("id, name, amount, frequency, next_due_date, house_bill_shares(user_id, amount)").eq("house_id", house.id).eq("is_active", true).order("next_due_date", { nullsFirst: false }),
      supabase.from("house_tasks").select("id, title, description, frequency, next_due_at, completed_at, house_task_assignees(user_id)").eq("house_id", house.id).is("completed_at", null).order("next_due_at"),
      supabase.from("house_events").select("id, title, description, start_date, end_date, start_time, end_time, house_event_tag_links(event_tags(id, name, color))").eq("house_id", house.id).gte("end_date", new Date().toISOString().slice(0, 10)).order("start_date"),
      supabase.from("event_tags").select("id, name, color, is_default").eq("house_id", house.id).order("is_default", { ascending: false }).order("name"),
      supabase.from("house_invites").select("id, code, type, recipient_email, max_uses, used_count, expires_at, revoked_at").eq("house_id", house.id).is("revoked_at", null).eq("used_count", 0).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order("created_at", { ascending: false }),
      supabase.rpc("get_my_house_permissions", { target_house: house.id }),
      supabase.from("shopping_items").select("id, name, priority, scope, personal_for, purchased_at, requested_by").eq("house_id", house.id).is("purchased_at", null).order("created_at"),
      supabase.from("member_debts").select("id, debtor_id, creditor_id, amount, description, source_type, source_id, settled_at, created_at").eq("house_id", house.id).is("settled_at", null).order("created_at", { ascending: false }),
      supabase.from("debt_adjustments").select("id, participant_ids, original_debts, created_at").eq("house_id", house.id).order("created_at", { ascending: false }),
      supabase.from("activity_logs").select("id, actor_id, description, created_at").eq("house_id", house.id).order("created_at", { ascending: false }).limit(10),
    ]);
    if (membershipError || billError) {
      const missingBills = billError?.code === "PGRST205" || billError?.message.includes("house_bills");
      setLoadError(missingBills ? "A gestão de contas ainda não está configurada no Supabase. Executa as migrações 003 e 004." : membershipError?.message ?? billError?.message ?? "Não foi possível carregar os dados da casa.");
    }
    const ids = (membershipData ?? []).map((member) => member.user_id);
    const { data: publicProfiles } = ids.length ? await supabase.from("public_profiles").select("id, username, avatar_url").in("id", ids) : { data: [] };
    setMembers((membershipData ?? []).map((member) => {
      const publicProfile = publicProfiles?.find((item) => item.id === member.user_id);
      return { ...member, username: publicProfile?.username ?? profile.username ?? "Membro", avatar_url: publicProfile?.avatar_url ?? null };
    }));
    setBills((billData as Bill[] | null) ?? []);
    setTasks((taskData as Task[] | null) ?? []);
    setEvents((eventData as HouseEvent[] | null) ?? []);
    setEventTags((eventTagData as EventTag[] | null) ?? []);
    setInvites((inviteData as Invite[] | null) ?? []);
    if (permissionData) setPermissions((current) => ({ ...current, ...Object.fromEntries(permissionData.map((item: { section: PermissionSection; level: PermissionLevel }) => [item.section, item.level])) }));
    setShoppingItems((shoppingData as ShoppingItem[] | null) ?? []);
    setDebts((debtData as Debt[] | null) ?? []);
    setDebtAdjustments((adjustmentData as DebtAdjustment[] | null) ?? []);
    setLogs((logData as ActivityLog[] | null) ?? []);
    if (taskError && !loadError) setLoadError(taskError.message.includes("house_tasks") ? "As tarefas ainda não estão configuradas no Supabase. Executa a migração 005." : taskError.message);
    setLoading(false);
  }

  useEffect(() => { void loadHouseData(); }, [house.id]);
  useEffect(() => {
    document.documentElement.dataset.housePalette = house.appearance_preset || "light";
    return () => { delete document.documentElement.dataset.housePalette; };
  }, [house.appearance_preset]);
  useEffect(() => {
    const currentBase = section === "create-bill" ? "bills" : section === "create-task" ? "tasks" : section === "create-event" ? "events" : section;
    if (permissions[currentBase as PermissionSection] !== "none") return;
    const fallback = (["dashboard", "events", "bills", "tasks", "shopping", "finance", "members", "permissions"] as PermissionSection[]).find((item) => permissions[item] !== "none");
    if (fallback) setSection(fallback);
  }, [permissions, section]);

  function navigate(next: HouseSection) { setSection(next); if (window.innerWidth <= 850) onCloseMenu(); }

  return <div className={`house-shell ${menuOpen ? "" : "sidebar-collapsed"}`}>
    <HouseSidebar house={house} members={members} permissions={permissions} section={section} open={menuOpen} onBack={onBack} onClose={onCloseMenu} onNavigate={navigate} />
    <section className="house-main">
      {section === "create-bill"
        ? <CreateBillPage house={house} members={members} supabase={supabase} onBack={() => setSection("bills")} onCreated={async () => { await loadHouseData(); setSection("bills"); }} />
        : section === "create-event"
          ? <CreateEventPage house={house} tags={eventTags} supabase={supabase} onBack={() => setSection("events")} onCreated={async () => { await loadHouseData(); setSection("events"); }} />
        : section === "create-task"
          ? <CreateTaskPage house={house} members={members} supabase={supabase} onBack={() => setSection("tasks")} onCreated={async () => { await loadHouseData(); setSection("tasks"); }} />
          : section === "members"
            ? <MembersPage house={house} members={members} invites={invites} supabase={supabase} canEdit={permissions.members === "edit"} onChanged={loadHouseData} />
            : section === "permissions"
              ? <PermissionsPage house={house} members={members} supabase={supabase} />
              : section === "shopping"
                ? <ShoppingPage house={house} members={members} items={shoppingItems} supabase={supabase} canEdit={permissions.shopping === "edit"} onChanged={loadHouseData} />
                : section === "finance"
                  ? <FinancePage house={house} members={members} debts={debts} adjustments={debtAdjustments} supabase={supabase} canEdit={permissions.finance === "edit"} onChanged={loadHouseData} />
                  : section === "settings"
                    ? <HouseSettingsPage house={house} supabase={supabase} onChanged={loadHouseData} />
                    : section === "events"
                      ? <EventsPage house={house} events={events} tags={eventTags} supabase={supabase} canEdit={permissions.events === "edit"} onCreate={() => setSection("create-event")} onChanged={loadHouseData} />
        : <><div className="house-page-heading"><div><span className="eyebrow">{section === "dashboard" ? "Visão geral" : section === "tasks" ? "Organização" : "Finanças"}</span><h1>{section === "dashboard" ? house.name : section === "tasks" ? "Tarefas da casa" : "Contas da casa"}</h1><p>{section === "dashboard" ? "O ponto de situação da vossa casa." : section === "tasks" ? "Próximas tarefas e respetivos responsáveis." : "Valores recorrentes e quem paga cada parte."}</p></div>{section === "bills" && permissions.bills === "edit" && <button className="primary-button compact" onClick={() => setSection("create-bill")}><Plus size={18} /> Nova conta</button>}{section === "tasks" && permissions.tasks === "edit" && <button className="primary-button compact" onClick={() => setSection("create-task")}><Plus size={18} /> Nova tarefa</button>}</div>
          {loadError && <p className="feedback error house-load-error">{loadError}</p>}
          {loading ? <div className="dashboard-panel loading-panel"><LoaderCircle className="spin" /></div> : section === "tasks" ? <TasksPanel tasks={tasks} members={members} expanded onOpen={() => setSection("tasks")} supabase={supabase} canEdit={permissions.tasks === "edit"} onChanged={loadHouseData} /> : section === "bills" ? <BillsPanel bills={bills} members={members} currency={house.currency} expanded onOpen={() => setSection("bills")} /> : <div className="dashboard-containers">{permissions.events !== "none" && <div className="dashboard-wide"><EventsCalendar events={events} onOpen={() => setSection("events")} /></div>}{permissions.bills !== "none" && <BillsPanel bills={bills} members={members} currency={house.currency} expanded={false} onOpen={() => setSection("bills")} />}{permissions.tasks !== "none" && <TasksPanel tasks={tasks} members={members} expanded={false} onOpen={() => setSection("tasks")} supabase={supabase} canEdit={permissions.tasks === "edit"} onChanged={loadHouseData} />}{permissions.shopping !== "none" && <ShoppingSummary items={shoppingItems} onOpen={() => setSection("shopping")} />}{permissions.dashboard !== "none" && <LogsPanel logs={logs} members={members} />}</div>}</>}
    </section>
  </div>;
}
