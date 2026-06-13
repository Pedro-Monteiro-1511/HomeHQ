export type AuthMode = "login" | "register" | "forgot";
export type Theme = "light" | "dark";
export type HouseSection = "dashboard" | "events" | "create-event" | "bills" | "create-bill" | "tasks" | "create-task" | "members" | "permissions" | "shopping" | "finance" | "settings";

export type Profile = {
  username: string | null;
  gender: string | null;
  avatar_url: string | null;
  profile_completed_at: string | null;
  created_at: string;
};

export type House = {
  id: string;
  name: string;
  invite_code: string;
  currency: string;
  timezone: string;
  appearance_preset: "light" | "dark" | "ocean";
  created_at: string;
};

export type HouseMember = { user_id: string; role: string; username: string; avatar_url: string | null };
export type Bill = { id: string; name: string; amount: number; frequency: string; next_due_date: string | null; house_bill_shares: { user_id: string; amount: number }[] };
export type Task = { id: string; title: string; description: string | null; frequency: string; next_due_at: string; completed_at: string | null; house_task_assignees: { user_id: string }[] };
export type Invite = { id: string; code: string; type: "email" | "qr"; recipient_email: string | null; max_uses: number | null; used_count: number; expires_at: string | null; revoked_at: string | null };
export type PendingInvite = { id: string; code: string; expires_at: string | null; house_id: string; house_name: string };
export type PermissionLevel = "none" | "view" | "edit";
export type PermissionSection = "dashboard" | "events" | "bills" | "tasks" | "members" | "permissions" | "shopping" | "finance";
export type HousePermissions = Record<PermissionSection, PermissionLevel>;
export type ShoppingItem = { id: string; name: string; priority: "low" | "normal" | "high" | "urgent"; scope: "house" | "personal"; personal_for: string | null; purchased_at: string | null; requested_by: string };
export type Debt = { id: string; debtor_id: string; creditor_id: string; amount: number; description: string; source_type: string; source_id: string | null; settled_at: string | null; created_at: string };
export type DebtAdjustment = { id: string; participant_ids: string[]; original_debts: { id: string; debtor_id: string; creditor_id: string; amount: number; description: string; source_type: string; source_id: string | null }[]; created_at: string };
export type ActivityLog = { id: number; actor_id: string | null; description: string; created_at: string };
export type EventTag = { id: string; name: string; color: string; is_default?: boolean };
export type HouseEvent = {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  house_event_tag_links: { event_tags: EventTag | null }[];
};
