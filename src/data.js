// Camada de dados — substitui o storage.js antigo (que salvava tudo como um
// blob único no localStorage). Cada função aqui lê/escreve uma linha real no
// Postgres do Supabase, filtrado pelas RLS policies da migration
// supabase/migrations/0001_init.sql. Os nomes de campo em JS continuam
// camelCase (mesmo shape que o resto do App.jsx já usava); só aqui na borda
// convertemos para snake_case das colunas.
import { supabase } from "./supabaseClient.js";

function check(error) {
  if (error) throw error;
}

/* ------------------------------- profiles / team ------------------------------- */

export async function fetchTeam() {
  const { data, error } = await supabase.from("fluxo_profiles").select("*").order("created_at");
  check(error);
  return data.map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, status: r.status }));
}

export async function inviteTeamMember({ name, email, role }) {
  const { data, error } = await supabase.functions.invoke("invite-team-member", { body: { name, email, role } });
  if (error) {
    let message = error.message;
    try {
      const body = await error.context.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function updateTeamMemberStatus(id, status) {
  const { error } = await supabase.from("fluxo_profiles").update({ status }).eq("id", id);
  check(error);
}

export async function deleteTeamMember(id) {
  const { error } = await supabase.from("fluxo_profiles").delete().eq("id", id);
  check(error);
}

/** Chamada logo após o login: se o convite ainda está pendente, vira "ativo". */
export async function activateProfileIfPending(id) {
  const { error } = await supabase.from("fluxo_profiles").update({ status: "ativo" }).eq("id", id).eq("status", "convite pendente");
  check(error);
}

export async function fetchMyProfile(id) {
  const { data, error } = await supabase.from("fluxo_profiles").select("*").eq("id", id).maybeSingle();
  check(error);
  return data ? { id: data.id, name: data.name, email: data.email, role: data.role, status: data.status } : null;
}

/* ---------------------------------- clients ---------------------------------- */

const clientFromRow = (r) => ({
  id: r.id,
  name: r.name,
  units: r.units || [],
  portfolioOwnerId: r.portfolio_owner_id || "",
  priorityMetrics: r.priority_metrics || [],
  deliverables: r.deliverables || [],
  diagnosis: r.diagnosis || "",
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
});

const clientToRow = (c) => ({
  id: c.id,
  name: c.name,
  units: c.units,
  portfolio_owner_id: c.portfolioOwnerId || null,
  priority_metrics: c.priorityMetrics,
  deliverables: c.deliverables,
  diagnosis: c.diagnosis,
});

export async function fetchClients() {
  const { data, error } = await supabase.from("fluxo_clients").select("*").order("created_at");
  check(error);
  return data.map(clientFromRow);
}

export async function insertClient(client) {
  const { error } = await supabase.from("fluxo_clients").insert(clientToRow(client));
  check(error);
}

export async function deleteClient(id) {
  const { error } = await supabase.from("fluxo_clients").delete().eq("id", id);
  check(error);
}

/* ---------------------------------- entries ---------------------------------- */

const entryFromRow = (r) => ({
  id: r.id,
  clientId: r.client_id,
  unitId: r.unit_id,
  periodStart: r.period_start || "",
  periodEnd: r.period_end,
  metrics: r.metrics || {},
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
});

const entryToRow = (e) => ({
  id: e.id,
  client_id: e.clientId,
  unit_id: e.unitId,
  period_start: e.periodStart || null,
  period_end: e.periodEnd,
  metrics: e.metrics,
});

export async function fetchEntries() {
  const { data, error } = await supabase.from("fluxo_entries").select("*").order("period_end");
  check(error);
  return data.map(entryFromRow);
}

export async function insertEntry(entry) {
  const { error } = await supabase.from("fluxo_entries").insert(entryToRow(entry));
  check(error);
}

/* ---------------------------------- demands ---------------------------------- */

const demandFromRow = (r) => ({
  id: r.id,
  title: r.title,
  clientId: r.client_id,
  unitId: r.unit_id || "",
  description: r.description || "",
  priority: r.priority,
  dueDate: r.due_date || "",
  status: r.status,
  origin: r.origin,
  type: r.type,
  assigneeId: r.assignee_id || "",
  recurring: r.recurring || { enabled: false, freq: "" },
  briefing: r.briefing || "",
  attachments: r.attachments || [],
  requiresProof: r.requires_proof,
  proofQuestion: r.proof_question || "",
  proof: r.proof || null,
  proofStatus: r.proof_status,
  reviewNote: r.review_note || undefined,
  actions: r.actions || [],
  checklist: r.checklist || undefined,
  weekKey: r.week_key || undefined,
  dayKey: r.day_key || undefined,
  platform: r.platform || undefined,
  observation: r.observation ?? undefined,
  originAlertKey: r.origin_alert_key || undefined,
  originInsightKey: r.origin_insight_key || undefined,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
});

const demandToRow = (d) => ({
  id: d.id,
  title: d.title,
  client_id: d.clientId || null,
  unit_id: d.unitId || null,
  description: d.description || "",
  priority: d.priority,
  due_date: d.dueDate || null,
  status: d.status,
  origin: d.origin,
  type: d.type,
  assignee_id: d.assigneeId || null,
  recurring: d.recurring || { enabled: false, freq: "" },
  briefing: d.briefing || "",
  attachments: d.attachments || [],
  requires_proof: !!d.requiresProof,
  proof_question: d.proofQuestion || "",
  proof: d.proof || null,
  proof_status: d.proofStatus || "pendente",
  review_note: d.reviewNote || null,
  actions: d.actions || [],
  checklist: d.checklist || null,
  week_key: d.weekKey || null,
  day_key: d.dayKey || null,
  platform: d.platform || null,
  observation: d.observation ?? null,
  origin_alert_key: d.originAlertKey || null,
  origin_insight_key: d.originInsightKey || null,
});

export async function fetchDemands() {
  const { data, error } = await supabase.from("fluxo_demands").select("*").order("created_at");
  check(error);
  return data.map(demandFromRow);
}

export async function insertDemand(demand) {
  const { error } = await supabase.from("fluxo_demands").insert(demandToRow(demand));
  check(error);
}

export async function insertDemands(demands) {
  if (!demands.length) return;
  const { error } = await supabase.from("fluxo_demands").insert(demands.map(demandToRow));
  check(error);
}

export async function updateDemand(demand) {
  const { error } = await supabase.from("fluxo_demands").update(demandToRow(demand)).eq("id", demand.id);
  check(error);
}

export async function deleteDemand(id) {
  const { error } = await supabase.from("fluxo_demands").delete().eq("id", id);
  check(error);
}

/* -------------------------------- notifications -------------------------------- */

const notificationFromRow = (r) => ({
  id: r.id,
  memberId: r.member_id,
  message: r.message,
  demandId: r.demand_id || null,
  read: r.read,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
});

const notificationToRow = (n) => ({
  id: n.id,
  member_id: n.memberId,
  message: n.message,
  demand_id: n.demandId || null,
  read: !!n.read,
});

export async function fetchNotifications() {
  const { data, error } = await supabase.from("fluxo_notifications").select("*").order("created_at");
  check(error);
  return data.map(notificationFromRow);
}

export async function insertNotification(notif) {
  const { error } = await supabase.from("fluxo_notifications").insert(notificationToRow(notif));
  check(error);
}

export async function insertNotifications(notifs) {
  if (!notifs.length) return;
  const { error } = await supabase.from("fluxo_notifications").insert(notifs.map(notificationToRow));
  check(error);
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from("fluxo_notifications").update({ read: true }).eq("id", id);
  check(error);
}

/* ----------------------------- communication rules ----------------------------- */

const ruleFromRow = (r) => ({
  id: r.id,
  name: r.name,
  active: r.active,
  trigger: r.trigger,
  daysBefore: r.days_before ?? 0,
  dayOfMonth: r.day_of_month ?? 1,
  statusAlvo: r.status_alvo || "",
  demandTypeFilter: r.demand_type_filter || "todos",
  recipientMode: r.recipient_mode || "responsavel",
  recipientId: r.recipient_id || "",
  message: r.message,
});

const ruleToRow = (r) => ({
  id: r.id,
  name: r.name,
  active: r.active,
  trigger: r.trigger,
  days_before: r.daysBefore ?? null,
  day_of_month: r.dayOfMonth ?? null,
  status_alvo: r.statusAlvo || null,
  demand_type_filter: r.demandTypeFilter || "todos",
  recipient_mode: r.recipientMode || "responsavel",
  recipient_id: r.recipientId || null,
  message: r.message,
});

export async function fetchRules() {
  const { data, error } = await supabase.from("fluxo_communication_rules").select("*").order("created_at");
  check(error);
  return data.map(ruleFromRow);
}

export async function insertRule(rule) {
  const { error } = await supabase.from("fluxo_communication_rules").insert(ruleToRow(rule));
  check(error);
}

export async function updateRule(rule) {
  const { error } = await supabase.from("fluxo_communication_rules").update(ruleToRow(rule)).eq("id", rule.id);
  check(error);
}

export async function deleteRule(id) {
  const { error } = await supabase.from("fluxo_communication_rules").delete().eq("id", id);
  check(error);
}

/* -------------------------------- rule fire log -------------------------------- */

export async function fetchRuleFireLog() {
  const { data, error } = await supabase.from("fluxo_rule_fire_log").select("key");
  check(error);
  return data.map((r) => r.key);
}

export async function insertFireKeys(keys) {
  if (!keys.length) return;
  // ignora chaves que já existem (duas sessões podem detectar o mesmo disparo ao mesmo tempo)
  const { error } = await supabase.from("fluxo_rule_fire_log").upsert(
    keys.map((key) => ({ key })),
    { onConflict: "key", ignoreDuplicates: true }
  );
  check(error);
}
