import { ArrowLeft, CalendarDays, CircleDollarSign, KeyRound, LayoutDashboard, ListChecks, Repeat2, ReceiptText, Settings2, ShoppingBasket, Users, X } from "lucide-react";
import type { House, HouseMember, HousePermissions, HouseSection } from "@/types/homehq";

type HouseSidebarProps = {
  house: House;
  members: HouseMember[];
  permissions: HousePermissions;
  section: HouseSection;
  open: boolean;
  onBack: () => void;
  onClose: () => void;
  onNavigate: (section: HouseSection) => void;
};

export function HouseSidebar({ house, members, permissions, section, open, onBack, onClose, onNavigate }: HouseSidebarProps) {
  return <>
    {open && <button className="sidebar-backdrop" onClick={onClose} aria-label="Fechar menu" />}
    <aside className={`house-sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-heading">
        <button className="icon-button" onClick={onBack} aria-label="Voltar"><ArrowLeft size={18} /></button>
        <div><span>Casa</span><strong>{house.name}</strong></div>
        <button className="icon-button sidebar-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
      </div>
      <nav>
        {permissions.dashboard !== "none" && <button className={section === "dashboard" ? "active" : ""} onClick={() => onNavigate("dashboard")}><LayoutDashboard size={18} /> Dashboard</button>}
        {permissions.events !== "none" && <button className={section === "events" || section === "create-event" ? "active" : ""} onClick={() => onNavigate("events")}><CalendarDays size={18} /> Eventos</button>}
        {permissions.bills !== "none" && <button className={section === "bills" || section === "create-bill" ? "active" : ""} onClick={() => onNavigate("bills")}><ReceiptText size={18} /> Contas</button>}
        {permissions.tasks !== "none" && <button className={section === "tasks" || section === "create-task" ? "active" : ""} onClick={() => onNavigate("tasks")}><ListChecks size={18} /> Tarefas</button>}
        {permissions.shopping !== "none" && <button className={section === "shopping" ? "active" : ""} onClick={() => onNavigate("shopping")}><ShoppingBasket size={18} /> Compras</button>}
        {permissions.finance !== "none" && <button className={section === "finance" ? "active" : ""} onClick={() => onNavigate("finance")}><CircleDollarSign size={18} /> Saldos</button>}
        {permissions.members !== "none" && <button className={section === "members" ? "active" : ""} onClick={() => onNavigate("members")}><Users size={18} /> Membros</button>}
        {permissions.permissions === "edit" && <button className={section === "permissions" ? "active" : ""} onClick={() => onNavigate("permissions")}><KeyRound size={18} /> Permissões</button>}
      </nav>
      <div className="sidebar-bottom">
        <button className="switch-house-button" onClick={onBack}><Repeat2 size={18} /> Trocar de casa</button>
        <button className={section === "settings" ? "active" : ""} onClick={() => onNavigate("settings")}><Settings2 size={18} /> Definições da casa</button>
        <div className="sidebar-house-meta"><span>{house.currency}</span><span>{members.length} membro{members.length === 1 ? "" : "s"}</span></div>
      </div>
    </aside>
  </>;
}
