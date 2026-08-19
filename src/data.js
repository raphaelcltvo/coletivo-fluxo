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
  return data.map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, status: r.status, allowedTabs: r.allowed_tabs || null }));
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

export async function updateTeamMemberTabs(id, allowedTabs) {
  const { error } = await supabase.from("fluxo_profiles").update({ allowed_tabs: allowedTabs }).eq("id", id);
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
  return data
    ? { id: data.id, name: data.name, email: data.email, role: data.role, status: data.status, onboardedAt: data.onboarded_at, allowedTabs: data.allowed_tabs || null }
    : null;
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
  driveUrl: r.drive_url || "",
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
  drive_url: c.driveUrl || null,
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

export async function updateClientDrive(id, driveUrl) {
  const { error } = await supabase.from("fluxo_clients").update({ drive_url: driveUrl || null }).eq("id", id);
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
  assigneeIds: r.assignee_ids || [],
  demandTypeId: r.demand_type_id || "",
  customFields: r.custom_fields || {},
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
  alertId: r.alert_id || undefined,
  boardOrder: r.board_order ?? 0,
  archivedAt: r.archived_at ? new Date(r.archived_at).getTime() : null,
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
  assignee_ids: d.assigneeIds || [],
  demand_type_id: d.demandTypeId || null,
  custom_fields: d.customFields || {},
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
  alert_id: d.alertId || null,
  board_order: d.boardOrder ?? 0,
  archived_at: d.archivedAt ? new Date(d.archivedAt).toISOString() : null,
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

/* ---------------------------- tipos de demanda (configurações) ---------------------------- */

const demandTypeFromRow = (r) => ({ id: r.id, name: r.name });
const demandTypeFieldFromRow = (r) => ({
  id: r.id,
  typeId: r.type_id,
  label: r.label,
  fieldType: r.field_type,
  options: r.options || [],
  dependsOnFieldId: r.depends_on_field_id || "",
  dependsOnValue: r.depends_on_value || "",
  sortOrder: r.sort_order ?? 0,
});

export async function fetchDemandTypes() {
  const { data, error } = await supabase.from("fluxo_demand_types").select("*").order("created_at");
  check(error);
  return data.map(demandTypeFromRow);
}

export async function insertDemandType(type) {
  const { error } = await supabase.from("fluxo_demand_types").insert({ id: type.id, name: type.name });
  check(error);
}

export async function deleteDemandType(id) {
  const { error } = await supabase.from("fluxo_demand_types").delete().eq("id", id);
  check(error);
}

export async function fetchDemandTypeFields() {
  const { data, error } = await supabase.from("fluxo_demand_type_fields").select("*").order("sort_order");
  check(error);
  return data.map(demandTypeFieldFromRow);
}

export async function insertDemandTypeField(field) {
  const { error } = await supabase.from("fluxo_demand_type_fields").insert({
    id: field.id, type_id: field.typeId, label: field.label, field_type: field.fieldType,
    options: field.options || [], depends_on_field_id: field.dependsOnFieldId || null,
    depends_on_value: field.dependsOnValue || null, sort_order: field.sortOrder || 0,
  });
  check(error);
}

export async function deleteDemandTypeField(id) {
  const { error } = await supabase.from("fluxo_demand_type_fields").delete().eq("id", id);
  check(error);
}

/* -------------------------------- anexos (upload real) -------------------------------- */

export async function uploadAttachment(file) {
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const path = `${Math.random().toString(36).slice(2, 10)}-${Date.now()}${ext}`;
  const { error } = await supabase.storage.from("fluxo-attachments").upload(path, file);
  check(error);
  const { data } = supabase.storage.from("fluxo-attachments").getPublicUrl(path);
  return { name: file.name, url: data.publicUrl, size: file.size, mimeType: file.type };
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
  action: r.action || "notificacao",
  alertType: r.alert_type || "relatorio",
  alertTagIds: r.alert_tag_ids || [],
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
  action: r.action || "notificacao",
  alert_type: r.action === "alerta" ? r.alertType || "relatorio" : null,
  alert_tag_ids: r.alertTagIds || [],
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

/* ----------------------------------- temas e assuntos ----------------------------------- */

const themeGroupFromRow = (r) => ({ id: r.id, name: r.name, tone: r.tone, sortOrder: r.sort_order ?? 0 });
const themeGroupToRow = (g) => ({ id: g.id, name: g.name, tone: g.tone, sort_order: g.sortOrder ?? 0 });

export async function fetchThemeGroups() {
  const { data, error } = await supabase.from("fluxo_theme_groups").select("*").order("sort_order").order("name");
  check(error);
  return data.map(themeGroupFromRow);
}

export async function insertThemeGroup(group) {
  const { error } = await supabase.from("fluxo_theme_groups").insert(themeGroupToRow(group));
  check(error);
}

export async function updateThemeGroup(group) {
  const { error } = await supabase.from("fluxo_theme_groups").update(themeGroupToRow(group)).eq("id", group.id);
  check(error);
}

export async function deleteThemeGroup(id) {
  const { error } = await supabase.from("fluxo_theme_groups").delete().eq("id", id);
  check(error);
}

const themeFromRow = (r) => ({ id: r.id, name: r.name, tone: r.tone, groupId: r.group_id || "", clientId: r.client_id || "" });
const themeToRow = (t) => ({ id: t.id, name: t.name, tone: t.tone, group_id: t.groupId || null, client_id: t.clientId || null });

export async function fetchThemes() {
  const { data, error } = await supabase.from("fluxo_themes").select("*").order("name");
  check(error);
  return data.map(themeFromRow);
}

export async function insertTheme(theme) {
  const { error } = await supabase.from("fluxo_themes").insert(themeToRow(theme));
  check(error);
}

export async function deleteTheme(id) {
  const { error } = await supabase.from("fluxo_themes").delete().eq("id", id);
  check(error);
}

/** Cria/atualiza o assunto sincronizado do tema Cliente pra um cliente recém-cadastrado. */
export async function syncClientTheme(client, clienteGroupId) {
  const theme = { id: Math.random().toString(36).slice(2, 10), name: client.name, tone: "brand", groupId: clienteGroupId, clientId: client.id };
  const { error } = await supabase.from("fluxo_themes").insert(themeToRow(theme));
  check(error);
  return theme;
}

/* ----------------------------------- posts (Novidades) ----------------------------------- */

const postFromRow = (r) => ({
  id: r.id,
  authorId: r.author_id,
  clientId: r.client_id || "",
  audience: r.audience,
  message: r.message,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
});

const postToRow = (p) => ({
  id: p.id,
  author_id: p.authorId,
  client_id: p.clientId || null,
  audience: p.audience || "todos",
  message: p.message,
});

export async function fetchPosts() {
  const { data, error } = await supabase.from("fluxo_posts").select("*").order("created_at", { ascending: false });
  check(error);
  return data.map(postFromRow);
}

export async function insertPost(post, recipientIds = [], tagIds = []) {
  const { error } = await supabase.from("fluxo_posts").insert(postToRow(post));
  check(error);
  if (recipientIds.length) {
    const { error: recErr } = await supabase
      .from("fluxo_post_recipients")
      .insert(recipientIds.map((memberId) => ({ post_id: post.id, member_id: memberId })));
    check(recErr);
  }
  if (tagIds.length) {
    const { error: tagErr } = await supabase
      .from("fluxo_post_tags")
      .insert(tagIds.map((themeId) => ({ post_id: post.id, theme_id: themeId })));
    check(tagErr);
  }
}

export async function deletePost(id) {
  const { error } = await supabase.from("fluxo_posts").delete().eq("id", id);
  check(error);
}

export async function fetchPostRecipients() {
  const { data, error } = await supabase.from("fluxo_post_recipients").select("*");
  check(error);
  return data.map((r) => ({ postId: r.post_id, memberId: r.member_id }));
}

export async function fetchPostTags() {
  const { data, error } = await supabase.from("fluxo_post_tags").select("*");
  check(error);
  return data.map((r) => ({ postId: r.post_id, themeId: r.theme_id }));
}

export async function fetchPostReads() {
  const { data, error } = await supabase.from("fluxo_post_reads").select("*");
  check(error);
  return data.map((r) => ({ postId: r.post_id, memberId: r.member_id, readAt: new Date(r.read_at).getTime() }));
}

export async function markPostRead(postId, memberId) {
  const { error } = await supabase.from("fluxo_post_reads").upsert({ post_id: postId, member_id: memberId }, { onConflict: "post_id,member_id" });
  check(error);
}

const postReplyFromRow = (r) => ({
  id: r.id,
  postId: r.post_id,
  authorId: r.author_id,
  message: r.message,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
});

export async function fetchPostReplies() {
  const { data, error } = await supabase.from("fluxo_post_replies").select("*").order("created_at");
  check(error);
  return data.map(postReplyFromRow);
}

export async function insertPostReply(reply) {
  const { error } = await supabase.from("fluxo_post_replies").insert({
    id: reply.id, post_id: reply.postId, author_id: reply.authorId, message: reply.message,
  });
  check(error);
}

export async function fetchPostLikes() {
  const { data, error } = await supabase.from("fluxo_post_likes").select("*");
  check(error);
  return data.map((r) => ({ postId: r.post_id, memberId: r.member_id }));
}

export async function togglePostLike(postId, memberId, liked) {
  if (liked) {
    const { error } = await supabase.from("fluxo_post_likes").insert({ post_id: postId, member_id: memberId });
    check(error);
  } else {
    const { error } = await supabase.from("fluxo_post_likes").delete().eq("post_id", postId).eq("member_id", memberId);
    check(error);
  }
}

/* --------------------------------- mensagem direta (DM) --------------------------------- */

const dmConversationFromRow = (r) => ({
  id: r.id,
  memberAId: r.member_a_id,
  memberBId: r.member_b_id,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
});

export async function fetchDmConversations() {
  const { data, error } = await supabase.from("fluxo_dm_conversations").select("*").order("updated_at", { ascending: false });
  check(error);
  return data.map(dmConversationFromRow);
}

/** Sempre chama com os dois ids — a ordem não importa, a função normaliza. */
export async function findOrCreateDmConversation(memberAId, memberBId) {
  const [a, b] = [memberAId, memberBId].sort();
  const { data: existing, error: findErr } = await supabase
    .from("fluxo_dm_conversations").select("*").eq("member_a_id", a).eq("member_b_id", b).maybeSingle();
  check(findErr);
  if (existing) return dmConversationFromRow(existing);
  const id = Math.random().toString(36).slice(2, 10);
  const { error } = await supabase.from("fluxo_dm_conversations").insert({ id, member_a_id: a, member_b_id: b });
  check(error);
  return { id, memberAId: a, memberBId: b, createdAt: Date.now(), updatedAt: Date.now() };
}

const dmMessageFromRow = (r) => ({
  id: r.id,
  conversationId: r.conversation_id,
  senderId: r.sender_id,
  message: r.message,
  readAt: r.read_at ? new Date(r.read_at).getTime() : null,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
});

export async function fetchDmMessages(conversationId) {
  const { data, error } = await supabase
    .from("fluxo_dm_messages").select("*").eq("conversation_id", conversationId).order("created_at");
  check(error);
  return data.map(dmMessageFromRow);
}

export async function insertDmMessage(message) {
  const { error } = await supabase.from("fluxo_dm_messages").insert({
    id: message.id, conversation_id: message.conversationId, sender_id: message.senderId, message: message.message,
  });
  check(error);
  await supabase.from("fluxo_dm_conversations").update({ updated_at: new Date().toISOString() }).eq("id", message.conversationId);
}

export async function markDmConversationRead(conversationId, myId) {
  const { error } = await supabase
    .from("fluxo_dm_messages").update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId).neq("sender_id", myId).is("read_at", null);
  check(error);
}

/* ----------------------------------- alerts ----------------------------------- */

const alertFromRow = (r) => ({
  id: r.id,
  title: r.title,
  description: r.description || "",
  alertType: r.alert_type,
  clientIds: r.client_ids || [],
  destino: r.destino || {},
  scheduledDate: r.scheduled_date,
  repeatFreq: r.repeat_freq,
  status: r.status,
  createsCard: r.creates_card,
  createdBy: r.created_by,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
});

const alertToRow = (a) => ({
  id: a.id,
  title: a.title,
  description: a.description || "",
  alert_type: a.alertType,
  client_ids: a.clientIds || [],
  destino: a.destino || {},
  scheduled_date: a.scheduledDate,
  repeat_freq: a.repeatFreq || "nenhuma",
  status: a.status || "agendado",
  creates_card: a.createsCard ?? true,
  created_by: a.createdBy,
});

export async function fetchAlerts() {
  const { data, error } = await supabase.from("fluxo_alerts").select("*").order("created_at", { ascending: false });
  check(error);
  return data.map(alertFromRow);
}

export async function insertAlert(alert, tagIds = []) {
  const { error } = await supabase.from("fluxo_alerts").insert(alertToRow(alert));
  check(error);
  if (tagIds.length) {
    const { error: tagErr } = await supabase
      .from("fluxo_alert_tags")
      .insert(tagIds.map((themeId) => ({ alert_id: alert.id, theme_id: themeId })));
    check(tagErr);
  }
}

export async function updateAlertStatus(id, status) {
  const { error } = await supabase.from("fluxo_alerts").update({ status }).eq("id", id);
  check(error);
}

export async function updateAlert(alert) {
  const { error } = await supabase.from("fluxo_alerts").update(alertToRow(alert)).eq("id", alert.id);
  check(error);
}

export async function fetchAlertTags() {
  const { data, error } = await supabase.from("fluxo_alert_tags").select("*");
  check(error);
  return data.map((r) => ({ alertId: r.alert_id, themeId: r.theme_id }));
}

/* --------------------------------- onboarding --------------------------------- */

export async function markOnboarded(id) {
  const { error } = await supabase.from("fluxo_profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", id);
  check(error);
}

/* --------------------------------- zeus --------------------------------- */

const zeusConversationFromRow = (r) => ({
  id: r.id,
  title: r.title,
  clientId: r.client_id || "",
  createdBy: r.created_by,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
});

export async function fetchZeusConversations() {
  const { data, error } = await supabase.from("fluxo_zeus_conversations").select("*").order("updated_at", { ascending: false });
  check(error);
  return data.map(zeusConversationFromRow);
}

export async function insertZeusConversation(conversation) {
  const { error } = await supabase.from("fluxo_zeus_conversations").insert({
    id: conversation.id,
    title: conversation.title || "Nova conversa",
    client_id: conversation.clientId || null,
    created_by: conversation.createdBy,
  });
  check(error);
}

export async function touchZeusConversation(id, clientId) {
  const patch = { updated_at: new Date().toISOString() };
  if (clientId !== undefined) patch.client_id = clientId || null;
  const { error } = await supabase.from("fluxo_zeus_conversations").update(patch).eq("id", id);
  check(error);
}

const zeusMessageFromRow = (r) => ({
  id: r.id,
  conversationId: r.conversation_id,
  role: r.role,
  content: r.content,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
});

export async function fetchZeusMessages(conversationId) {
  const { data, error } = await supabase
    .from("fluxo_zeus_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at");
  check(error);
  return data.map(zeusMessageFromRow);
}

const zeusKnowledgeFromRow = (r) => ({
  clientId: r.client_id,
  sheetUrl: r.sheet_url || "",
  keyIndicators: r.key_indicators || [],
  notes: r.notes || "",
  updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
});

export async function fetchZeusClientKnowledge() {
  const { data, error } = await supabase.from("fluxo_zeus_client_knowledge").select("*");
  check(error);
  return data.map(zeusKnowledgeFromRow);
}

const zeusDashboardFromRow = (r) => ({
  id: r.id,
  conversationId: r.conversation_id || "",
  clientId: r.client_id || "",
  filePath: r.file_path,
  url: r.url,
  createdBy: r.created_by,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
});

export async function fetchZeusDashboards() {
  const { data, error } = await supabase.from("fluxo_zeus_dashboards").select("*").order("created_at", { ascending: false });
  check(error);
  return data.map(zeusDashboardFromRow);
}

/** Manda uma mensagem pro Zeus (Edge Function zeus-chat) e devolve { conversationId, reply, ui }. */
export async function callZeus({ conversationId, clientId, message, image }) {
  const { data, error } = await supabase.functions.invoke("zeus-chat", { body: { conversationId, clientId, message, image } });
  if (error) {
    let msg = error.message;
    try {
      const body = await error.context.json();
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
