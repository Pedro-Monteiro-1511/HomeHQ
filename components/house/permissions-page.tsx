"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ChevronRight } from "lucide-react";
import type { ActivityLog, Bill, Debt, DebtAdjustment, EventTag, House, HouseEvent, HouseMember, HousePermissions, HouseSection, Invite, PendingInvite, PermissionLevel, PermissionSection, Profile, ShoppingItem, Task, Theme } from "@/types/homehq";

export function PermissionsPage({ house, members, supabase }: { house: House; members: HouseMember[]; supabase: SupabaseClient }) {
  const editableMembers = members.filter((member) => member.role !== "owner");
  const [selectedId, setSelectedId] = useState(editableMembers[0]?.user_id ?? "");
  const [values, setValues] = useState<Partial<Record<PermissionSection, PermissionLevel>>>({});
  const [loadingSection, setLoadingSection] = useState<PermissionSection | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const sections: { id: PermissionSection; label: string; description: string }[] = [
    { id: "dashboard", label: "Dashboard", description: "Visualização geral e containers da casa." },
    { id: "events", label: "Eventos", description: "Calendário, eventos e tags." },
    { id: "bills", label: "Contas", description: "Contas, valores e divisões." },
    { id: "tasks", label: "Tarefas", description: "Tarefas, responsáveis e conclusões." },
    { id: "members", label: "Membros", description: "Lista de membros e convites." },
    { id: "shopping", label: "Compras", description: "Lista de compras e confirmação de aquisição." },
    { id: "finance", label: "Gestão de €", description: "Dívidas e liquidações entre membros." },
    { id: "permissions", label: "Permissões", description: "Permite gerir os acessos dos restantes membros." },
  ];

  useEffect(() => {
    if (!editableMembers.length) { setSelectedId(""); return; }
    if (!editableMembers.some((member) => member.user_id === selectedId)) setSelectedId(editableMembers[0].user_id);
  }, [members, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setError(""); setFeedback("");
    supabase.rpc("get_house_member_permissions", { target_house: house.id, target_user: selectedId }).then(({ data, error: loadError }) => {
      if (loadError) { setError(loadError.message); return; }
      setValues(Object.fromEntries((data ?? []).map((item: { section: PermissionSection; level: PermissionLevel }) => [item.section, item.level])));
    });
  }, [selectedId]);

  async function changePermission(section: PermissionSection, level: PermissionLevel) {
    if (!selectedId) return;
    setLoadingSection(section); setError(""); setFeedback("");
    const { error: updateError } = await supabase.rpc("set_house_permission", { target_house: house.id, target_user: selectedId, target_section: section, target_level: level });
    if (updateError) setError(updateError.message);
    else {
      setValues((current) => ({ ...current, [section]: level }));
      setFeedback("Permissão atualizada.");
    }
    setLoadingSection(null);
  }

  return <div className="permissions-page"><div className="house-page-heading"><div><span className="eyebrow">Acessos</span><h1>Permissões</h1><p>Define o que cada membro pode ver e editar.</p></div></div>{error && <p className="feedback error">{error}</p>}{feedback && <p className="feedback success">{feedback}</p>}{editableMembers.length === 0 ? <div className="dashboard-panel panel-empty"><p>Adiciona outros membros para configurar permissões.</p></div> : <div className="permissions-layout"><aside className="dashboard-panel permission-members">{editableMembers.map((member) => <button className={selectedId === member.user_id ? "active" : ""} key={member.user_id} onClick={() => setSelectedId(member.user_id)}><span className="member-avatar">{member.username.slice(0, 1).toUpperCase()}</span><strong>{member.username}</strong><ChevronRight size={16} /></button>)}</aside><section className="dashboard-panel permission-sections">{sections.map((section) => <article key={section.id}><div><strong>{section.label}</strong><span>{section.description}</span></div><div className="permission-options">{(["edit", "view", "none"] as PermissionLevel[]).map((level) => <button disabled={loadingSection === section.id} className={values[section.id] === level ? "active" : ""} key={level} onClick={() => void changePermission(section.id, level)}>{level === "edit" ? "Editar" : level === "view" ? "Somente ver" : "Sem acesso"}</button>)}</div></article>)}</section></div>}</div>;
}
