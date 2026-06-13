"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Clock3, Copy, Home, KeyRound, Link2, ListChecks, LoaderCircle, Mail, Plus, QrCode, ReceiptText, Search, Settings2, ShoppingBasket, SlidersHorizontal, UserRound, Users, WalletCards, X } from "lucide-react";
import { AppHeader } from "@/components/shared/app-header";
import { HouseDashboard } from "@/components/house/house-dashboard";
import { HomePage } from "@/components/dashboard/home-page";
import { CreateHousePage } from "@/components/dashboard/create-house-page";
import { formatTaskDate } from "@/lib/homehq-utils";
import type { ActivityLog, Bill, Debt, DebtAdjustment, EventTag, House, HouseEvent, HouseMember, HousePermissions, HouseSection, Invite, PendingInvite, PermissionLevel, PermissionSection, Profile, ShoppingItem, Task, Theme } from "@/types/homehq";

export function Dashboard({ profile, email, supabase, onLogout, loading, theme, onToggleTheme }: { profile: Profile; email: string; supabase: SupabaseClient; onLogout: () => void; loading: boolean; theme: Theme; onToggleTheme: () => void }) {
  const houseCacheKey = `homehq-houses-${email.toLowerCase()}`;
  const [page, setPage] = useState<"home" | "create-house" | "house">("home");
  const [houseMenuOpen, setHouseMenuOpen] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loadingHouses, setLoadingHouses] = useState(true);

  async function loadHouses(showLoading = false) {
    if (showLoading) setLoadingHouses(true);
    const [{ data }, { data: inviteData }] = await Promise.all([
      supabase.from("houses").select("id, name, invite_code, currency, timezone, appearance_preset, created_at").order("created_at"),
      supabase.rpc("get_my_pending_invites"),
    ]);
    const nextHouses = data ?? [];
    localStorage.setItem(houseCacheKey, JSON.stringify(nextHouses));
    setHouses(nextHouses); setPendingInvites((inviteData as PendingInvite[] | null) ?? []); setLoadingHouses(false);
  }

  useEffect(() => {
    const cached = localStorage.getItem(houseCacheKey);
    if (cached) {
      try { setHouses(JSON.parse(cached) as House[]); setLoadingHouses(false); }
      catch { localStorage.removeItem(houseCacheKey); }
    }
    void loadHouses(!cached);
  }, []);

  return <main className="dashboard"><AppHeader theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout} loading={loading} onToggleMenu={page === "house" ? () => setHouseMenuOpen((open) => !open) : undefined} menuOpen={houseMenuOpen} />
    {page === "home"
      ? <HomePage profile={profile} email={email} houses={houses} pendingInvites={pendingInvites} supabase={supabase} loading={loadingHouses} onInvitesChanged={loadHouses} onCreate={() => setPage("create-house")} onOpen={(house) => { setSelectedHouse(house); setHouseMenuOpen(window.innerWidth > 850); setPage("house"); }} />
      : page === "create-house"
        ? <CreateHousePage supabase={supabase} onBack={() => setPage("home")} onCreated={async () => { await loadHouses(); setPage("home"); }} />
        : selectedHouse && <HouseDashboard house={selectedHouse} profile={profile} supabase={supabase} menuOpen={houseMenuOpen} onCloseMenu={() => setHouseMenuOpen(false)} onBack={() => { setHouseMenuOpen(false); setPage("home"); }} />}
  </main>;
}
