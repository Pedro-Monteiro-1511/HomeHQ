"use client";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CheckCircle2 } from "lucide-react";
import type { ActivityLog, Bill, Debt, DebtAdjustment, EventTag, House, HouseEvent, HouseMember, HousePermissions, HouseSection, Invite, PendingInvite, PermissionLevel, PermissionSection, Profile, ShoppingItem, Task, Theme } from "@/types/homehq";

export function HouseSettingsPage({ house, supabase, onChanged }: { house: House; supabase: SupabaseClient; onChanged: () => void }) {
  const [selected, setSelected] = useState(house.appearance_preset || "light");
  const [error, setError] = useState("");
  const palettes: { id: House["appearance_preset"]; name: string; colors: string[] }[] = [
    { id: "light", name: "Claro", colors: ["#f5f7f2", "#ffffff", "#1d6748", "#dff08f"] },
    { id: "dark", name: "Escuro", colors: ["#101713", "#18211c", "#67b78e", "#dff08f"] },
    { id: "ocean", name: "Ocean", colors: ["#112E81", "#4647AE", "#4382DF", "#AACCD6"] },
  ];
  async function choose(preset: House["appearance_preset"]) {
    setError(""); setSelected(preset); document.documentElement.dataset.housePalette = preset;
    const { error: updateError } = await supabase.rpc("set_house_appearance", { target_house: house.id, preset });
    if (updateError) { setError(updateError.message); return; }
    await onChanged();
  }
  return <div className="settings-page"><div className="house-page-heading"><div><span className="eyebrow">Configuração</span><h1>Definições da casa</h1><p>Preferências partilhadas por todos os membros.</p></div></div><section className="dashboard-panel settings-section"><div><strong>Aparência</strong><span>Escolhe a paleta utilizada dentro desta casa.</span></div><div className="palette-grid">{palettes.map((palette) => <button className={selected === palette.id ? "active" : ""} key={palette.id} onClick={() => void choose(palette.id)}><span>{palette.colors.map((color) => <i key={color} style={{ background: color }} />)}</span><strong>{palette.name}</strong>{selected === palette.id && <CheckCircle2 size={16} />}</button>)}</div>{error && <p className="feedback error">{error}</p>}</section></div>;
}
