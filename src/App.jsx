import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabaseClient.js";
import { useSession, Login, SetPassword } from "./auth.jsx";
import * as db from "./data.js";
import { THEMES, VAR_KEYS, C, FONT_IMPORT, Ticket, Btn, inputStyle, Field, Ring } from "./ui.jsx";
import {
  Users, ClipboardList, TrendingUp, Bell, FileText, MessageSquare,
  Plus, X, ChevronRight, Clock, Copy, Trash2, ArrowUpRight, ArrowDownRight,
  Store, Target, UserCog, Mail, Paperclip, Repeat, Lock, Sun, Moon, ChevronDown, CheckCircle2,
  Send, Megaphone, CalendarClock, Zap, LogOut, Rss,
} from "lucide-react";
import { ThreadsView, TagPicker, ThemeManager, resolveTone } from "./threads.jsx";
import { Onboarding } from "./onboarding.jsx";
import { ManualAlertsSection, resolveDestinoIds } from "./alerts.jsx";
import { ZeusView } from "./zeus.jsx";

/* ---------------------------------------------------------------------- */
/* METRIC DEFINITIONS                                                      */
/* ---------------------------------------------------------------------- */
const METRICS = [
  { id: "vendas", label: "Vendas", fmt: "int", good: "up", defThresh: 10 },
  { id: "gmv", label: "GMV", fmt: "money", good: "up", defThresh: 10 },
  { id: "tm", label: "Ticket Médio", fmt: "money", good: "up", defThresh: 8 },
  { id: "novos", label: "Novos clientes", fmt: "int", good: "up", defThresh: 15 },
  { id: "visitas", label: "Visitas", fmt: "int", good: "up", defThresh: 12 },
  { id: "conversao", label: "Conversão %", fmt: "pct", good: "up", defThresh: 10 },
  { id: "budget", label: "Budget de investimento", fmt: "pct", good: "neutral", defThresh: 20 },
  { id: "promocoes", label: "Promoções + Ads", fmt: "money", good: "neutral", defThresh: 25 },
  { id: "subifood", label: "Subsídio iFood", fmt: "money", good: "down", defThresh: 20 },
  { id: "cpo", label: "CPO (custo por pedido)", fmt: "money", good: "down", defThresh: 12 },
  { id: "roi", label: "ROI", fmt: "money", good: "up", defThresh: 15 },
];
const metricById = (id) => METRICS.find((m) => m.id === id);

const fmtVal = (v, fmt) => {
  if (v === undefined || v === null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  if (fmt === "money") return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (fmt === "pct") return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
  return n.toLocaleString("pt-BR");
};

const DELIVERABLE_TYPES = ["Relatório interno", "Dash para o cliente", "Apresentação / reunião"];
const FREQS = ["Diário", "Semanal", "Quinzenal", "Mensal", "Trimestral"];
const DEMAND_TYPES = [
  { id: "geral", label: "Geral" },
  { id: "cobranca", label: "Cobrança recorrente" },
  { id: "produto", label: "Criação de categoria/produto" },
  { id: "dash_parcial", label: "Dash Parcial" },
  { id: "dash_consolidado", label: "Dash Consolidado" },
  { id: "rotina_semanal", label: "Rotina semanal — revisão de Dashes" },
  { id: "revisao_oculta", label: "Revisão de usuário oculto" },
];
const demandTypeLabel = (id) => DEMAND_TYPES.find((t) => t.id === id)?.label || "Geral";
const RECUR_FREQS = ["Semanal", "Quinzenal", "Mensal"];
const PROOF_DEFAULTS = {
  geral: "",
  cobranca: "Confirma que a cobrança foi enviada ao cliente?",
  produto: "Anexou o print/foto do produto já publicado?",
  dash_parcial: "O Dash foi atualizado com os números da semana?",
  dash_consolidado: "O Dash consolidado do mês foi enviado ao cliente?",
  rotina_semanal: "Revisou todos os Dashes da carteira e os números conferem com o esperado?",
  revisao_oculta: "Concluiu a simulação do pedido até o fim (chegou a finalizar)?",
};
const REQUIRES_PROOF_DEFAULT = { geral: false, cobranca: true, produto: true, dash_parcial: true, dash_consolidado: true, rotina_semanal: true, revisao_oculta: true };

const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------------------------------------------------------------------- */
/* DATE HELPERS                                                            */
/* ---------------------------------------------------------------------- */
function daysBetween(a, b) {
  return Math.abs(new Date(a) - new Date(b)) / 86400000;
}
function addInterval(dateStr, freq) {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (freq === "Semanal") d.setDate(d.getDate() + 7);
  else if (freq === "Quinzenal") d.setDate(d.getDate() + 14);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}
/* Mesma ideia de addInterval, mas com o vocabulário usado pelos Alertas manuais. */
function addAlertInterval(dateStr, freq) {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (freq === "diaria") d.setDate(d.getDate() + 1);
  else if (freq === "semanal") d.setDate(d.getDate() + 7);
  else if (freq === "mensal") d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}
function nextFixedDashDate(type) {
  const now = new Date();
  if (type === "dash_parcial") {
    const candidates = [8, 15, 22].map((d) => new Date(now.getFullYear(), now.getMonth(), d));
    const future = candidates.find((d) => d >= now);
    const target = future || new Date(now.getFullYear(), now.getMonth() + 1, 8);
    return target.toISOString().slice(0, 10);
  }
  if (type === "dash_consolidado") {
    return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  }
  return "";
}
function generateDashDemandsForMonth(clients, existing) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const out = [];
  clients.forEach((client) => {
    const dates = [
      ...[8, 15, 22].map((d) => ({ type: "dash_parcial", date: new Date(y, m, d).toISOString().slice(0, 10) })),
      { type: "dash_consolidado", date: new Date(y, m + 1, 1).toISOString().slice(0, 10) },
    ];
    dates.forEach(({ type, date }) => {
      const dup = existing.some((d) => d.clientId === client.id && d.type === type && d.dueDate === date);
      if (!dup) {
        out.push({
          id: uid(),
          title: `${type === "dash_parcial" ? "Dash Parcial" : "Dash Consolidado"} — ${client.name}`,
          clientId: client.id,
          unitId: "",
          description:
            type === "dash_parcial"
              ? "Atualização semanal do dashboard de performance do cliente."
              : "Fechamento mensal — consolidação do dashboard de performance do cliente.",
          priority: "normal",
          dueDate: date,
          status: "aberta",
          origin: "sistema",
          type,
          assigneeId: "",
          recurring: { enabled: false, freq: "" },
          briefing: "",
          attachments: [],
          requiresProof: REQUIRES_PROOF_DEFAULT[type],
          proofQuestion: PROOF_DEFAULTS[type],
          proof: null,
          proofStatus: "pendente",
          actions: [],
          createdAt: Date.now(),
        });
      }
    });
  });
  return out;
}

const RULE_TRIGGERS = [
  { id: "dias_antes_prazo", label: "X dias antes do prazo", group: "tempo" },
  { id: "dia_fixo_mes", label: "Dia fixo do mês", group: "tempo" },
  { id: "demanda_criada", label: "Quando uma demanda é criada", group: "acao" },
  { id: "status_mudou", label: "Quando o status muda", group: "acao" },
  { id: "alerta_disparado", label: "Quando um alerta dispara", group: "acao" },
];
const triggerLabel = (id) => RULE_TRIGGERS.find((t) => t.id === id)?.label || id;

function renderTemplate(msg, demand, client) {
  return (msg || "")
    .replaceAll("{titulo}", demand?.title || "")
    .replaceAll("{cliente}", client?.name || "")
    .replaceAll("{prazo}", demand?.dueDate || "sem prazo");
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/* Evaluates time-based rules (days-before-due, fixed day of month) against current demands. */
/* Régua com action="alerta": monta um Alerta manual em vez de só uma notificação. */
function alertFromRule(rule, message, client, viewerId) {
  return {
    id: uid(), title: message, description: "", alertType: rule.alertType || "relatorio",
    clientIds: client ? [client.id] : [], destino: { memberIds: [rule._recipient] },
    scheduledDate: todayStr(), repeatFreq: "nenhuma", status: "agendado",
    createdBy: viewerId, createdAt: Date.now(), tagIds: rule.alertTagIds || [],
  };
}

function evaluateTimeRules(rules, clients, demands, fireLog, viewerId) {
  const notifs = [];
  const newKeys = [];
  const alertsToCreate = [];
  const today = new Date();
  const todayKey = todayStr();
  const monthKey = todayKey.slice(0, 7);

  rules.filter((r) => r.active).forEach((rule) => {
    if (rule.trigger === "dias_antes_prazo") {
      demands.forEach((d) => {
        if (d.status === "concluida" || !d.dueDate) return;
        if (rule.demandTypeFilter !== "todos" && d.type !== rule.demandTypeFilter) return;
        const target = new Date(d.dueDate);
        target.setDate(target.getDate() - Number(rule.daysBefore || 0));
        if (target.toISOString().slice(0, 10) !== todayKey) return;
        const key = `${rule.id}:${d.id}:${todayKey}`;
        if (fireLog.includes(key)) return;
        const recipient = rule.recipientMode === "responsavel" ? d.assigneeId : rule.recipientId;
        if (!recipient) return;
        const client = clients.find((c) => c.id === d.clientId);
        const message = renderTemplate(rule.message, d, client);
        if (rule.action === "alerta") alertsToCreate.push(alertFromRule({ ...rule, _recipient: recipient }, message, client, viewerId));
        else notifs.push({ id: uid(), memberId: recipient, message, demandId: d.id, read: false, createdAt: Date.now() });
        newKeys.push(key);
      });
    }
    if (rule.trigger === "dia_fixo_mes") {
      if (today.getDate() !== Number(rule.dayOfMonth)) return;
      const key = `${rule.id}:${monthKey}`;
      if (fireLog.includes(key)) return;
      if (!rule.recipientId) return;
      const message = rule.message || rule.name;
      if (rule.action === "alerta") alertsToCreate.push(alertFromRule({ ...rule, _recipient: rule.recipientId }, message, null, viewerId));
      else notifs.push({ id: uid(), memberId: rule.recipientId, message, demandId: null, read: false, createdAt: Date.now() });
      newKeys.push(key);
    }
  });
  return { notifs, newKeys, alertsToCreate };
}

/* Evaluates action-based rules for a single event (demand created / status changed). */
function evaluateActionRules(rules, trigger, demand, client, extra = {}, viewerId) {
  const notifs = [];
  const alertsToCreate = [];
  rules.filter((r) => r.active && r.trigger === trigger).forEach((rule) => {
    if (trigger !== "alerta_disparado" && rule.demandTypeFilter !== "todos" && demand.type !== rule.demandTypeFilter) return;
    if (trigger === "status_mudou" && rule.statusAlvo && rule.statusAlvo !== extra.newStatus) return;
    const recipient = rule.recipientMode === "responsavel" ? demand?.assigneeId : rule.recipientId;
    if (!recipient) return;
    const message = renderTemplate(rule.message, demand, client);
    if (rule.action === "alerta") alertsToCreate.push(alertFromRule({ ...rule, _recipient: recipient }, message, client, viewerId));
    else notifs.push({ id: uid(), memberId: recipient, message, demandId: demand?.id || null, read: false, createdAt: Date.now() });
  });
  return { notifs, alertsToCreate };
}

const REVIEW_PLATFORMS = ["iFood", "Cardápio digital", "99Food"];

function isMonday(date) {
  return date.getDay() === 1;
}

/* Weekly routine: every Monday, one checklist demand per portfolio owner listing their clients' Dashes to review. */
function generateWeeklyRoutine(clients, team, demands) {
  const now = new Date();
  if (!isMonday(now)) return [];
  const weekKey = todayStr();
  const owners = [...new Set(clients.map((c) => c.portfolioOwnerId).filter(Boolean))];
  const out = [];
  owners.forEach((ownerId) => {
    const dup = demands.some((d) => d.type === "rotina_semanal" && d.assigneeId === ownerId && d.weekKey === weekKey);
    if (dup) return;
    const myClients = clients.filter((c) => c.portfolioOwnerId === ownerId);
    out.push({
      id: uid(),
      title: `Revisão semanal de Dashes — ${myClients.map((c) => c.name).join(", ")}`,
      clientId: myClients[0]?.id || "",
      unitId: "",
      description: "Consultar todos os Dashes Parciais e Consolidados da carteira e verificar se algum número foge do esperado.",
      priority: "normal",
      dueDate: weekKey,
      status: "aberta",
      origin: "sistema",
      type: "rotina_semanal",
      assigneeId: ownerId,
      recurring: { enabled: false, freq: "" },
      briefing: "",
      attachments: [],
      checklist: myClients.map((c) => ({ clientId: c.id, clientName: c.name, checked: false })),
      weekKey,
      requiresProof: true,
      proofQuestion: PROOF_DEFAULTS.rotina_semanal,
      proof: null,
      proofStatus: "pendente",
      actions: [],
      createdAt: Date.now(),
    });
  });
  return out;
}

/* Daily routine: pick one client to "mystery shop", assigned to someone who does NOT own that portfolio. */
function generateDailyMysteryReview(clients, team, demands) {
  const dayKey = todayStr();
  if (demands.some((d) => d.type === "revisao_oculta" && d.dayKey === dayKey)) return [];
  const staff = team.filter((t) => t.status === "ativo" && t.role === "atendimento");
  if (staff.length === 0 || clients.length === 0) return [];

  const past = demands.filter((d) => d.type === "revisao_oculta");
  const lastReviewed = {};
  past.forEach((d) => { if (!lastReviewed[d.clientId] || d.dayKey > lastReviewed[d.clientId]) lastReviewed[d.clientId] = d.dayKey; });
  const sortedClients = [...clients].sort((a, b) => (lastReviewed[a.id] || "0000-00-00").localeCompare(lastReviewed[b.id] || "0000-00-00"));
  const client = sortedClients[0];

  const eligible = staff.filter((s) => s.id !== client.portfolioOwnerId);
  const pool = eligible.length > 0 ? eligible : staff;
  const lastByReviewer = {};
  past.forEach((d) => { if (!lastByReviewer[d.assigneeId] || d.dayKey > lastByReviewer[d.assigneeId]) lastByReviewer[d.assigneeId] = d.dayKey; });
  const reviewer = [...pool].sort((a, b) => (lastByReviewer[a.id] || "0000-00-00").localeCompare(lastByReviewer[b.id] || "0000-00-00"))[0];

  const platform = REVIEW_PLATFORMS[Math.floor(Math.random() * REVIEW_PLATFORMS.length)];

  return [{
    id: uid(),
    title: `Revisão de usuário oculto — ${client.name}`,
    clientId: client.id,
    unitId: "",
    description: `Simular um pedido como cliente comum pelo ${platform} e registrar o que observou (cardápio, fotos, preços, tempo de entrega, experiência geral).`,
    priority: "normal",
    dueDate: dayKey,
    status: "aberta",
    origin: "sistema",
    type: "revisao_oculta",
    assigneeId: reviewer.id,
    recurring: { enabled: false, freq: "" },
    briefing: "",
    attachments: [],
    platform,
    observation: "",
    dayKey,
    requiresProof: true,
    proofQuestion: PROOF_DEFAULTS.revisao_oculta,
    proof: null,
    proofStatus: "pendente",
    actions: [],
    createdAt: Date.now(),
  }];
}

/* ---------------------------------------------------------------------- */
/* CROSS-METRIC INSIGHT ENGINE                                             */
/* ---------------------------------------------------------------------- */
const INSIGHT_RULES = [
  { id: "visitas_sem_venda", test: (chg) => chg.visitas >= 10 && chg.vendas <= 3, title: "Visitas subiram mas vendas não acompanharam", suggestion: "Possível problema de cardápio — revisar fotos, descrições e preços dos produtos mais vistos." },
  { id: "conversao_caindo", test: (chg) => Math.abs(chg.visitas) <= 5 && chg.conversao <= -8, title: "Conversão caiu com tráfego estável", suggestion: "Fricção na loja — revisar preço, tempo de entrega estimado ou disponibilidade de produtos." },
  { id: "budget_sem_retorno", test: (chg) => chg.budget >= 15 && chg.vendas <= 3, title: "Investimento em Ads subiu sem retorno em vendas", suggestion: "Revisar segmentação e criativos das campanhas antes de manter o budget mais alto." },
  { id: "novos_ticket_baixo", test: (chg) => chg.novos >= 10 && chg.tm <= -6, title: "Novos clientes crescendo com ticket médio caindo", suggestion: "Mix de produtos pode estar puxando para itens de menor valor — revisar combos e destaque do cardápio." },
  { id: "gmv_sem_roi", test: (chg) => chg.gmv >= 8 && chg.roi <= -8, title: "GMV subiu mas ROI caiu", suggestion: "Crescimento pode estar vindo de promoção/subsídio, não de rentabilidade — revisar profundidade dos descontos." },
  { id: "cpo_conversao", test: (chg) => chg.cpo >= 10 && chg.conversao <= -6, title: "Custo por pedido subindo junto com queda de conversão", suggestion: "Pedidos mais caros para converter — revisar oferta e comparar com concorrência direta." },
];

function computeCrossInsights(clients, entries) {
  const insights = [];
  clients.forEach((client) => {
    client.units.forEach((unit) => {
      const list = entries.filter((e) => e.clientId === client.id && e.unitId === unit.id).sort((a, b) => new Date(a.periodEnd) - new Date(b.periodEnd));
      if (list.length < 2) return;
      const current = list[list.length - 1];
      const prev = list[list.length - 2];
      const chg = {};
      METRICS.forEach((m) => {
        const curV = Number(current.metrics[m.id]);
        const prevV = Number(prev.metrics[m.id]);
        chg[m.id] = Number.isFinite(curV) && Number.isFinite(prevV) && prevV !== 0 ? ((curV - prevV) / Math.abs(prevV)) * 100 : 0;
      });
      INSIGHT_RULES.forEach((rule) => {
        if (rule.test(chg)) insights.push({ id: `${client.id}-${unit.id}-${rule.id}-${current.periodEnd}`, clientId: client.id, clientName: client.name, unitId: unit.id, unitName: unit.name, title: rule.title, suggestion: rule.suggestion, periodEnd: current.periodEnd });
      });
    });
  });
  return insights;
}

/* ---------------------------------------------------------------------- */
/* GENERIC UI ATOMS                                                        */
/* ---------------------------------------------------------------------- */
const Badge = ({ children, tone = "muted" }) => {
  const tones = {
    muted: { bg: C.surface3, fg: C.muted },
    amber: { bg: C.amberDim, fg: C.amber },
    teal: { bg: C.tealDim, fg: C.teal },
    red: { bg: C.redDim, fg: C.red },
    brand: { bg: C.brandDim, fg: C.brandSoft },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        background: t.bg, color: t.fg, fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
        textTransform: "uppercase", padding: "3px 8px", borderRadius: 999,
        fontFamily: "Inter, sans-serif", whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
};

const Modal = ({ title, onClose, children, wide }) => (
  <div
    style={{ position: "fixed", inset: 0, background: "rgba(8,9,13,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 50, overflowY: "auto" }}
    onClick={onClose}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 14, width: "100%", maxWidth: wide ? 720 : 520, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: 0.3, color: C.text, margin: 0, textTransform: "uppercase" }}>
          {title}
        </h2>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 4 }}>
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const ViewHeader = ({ title, subtitle, action }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
    <div>
      <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 800, color: C.text, margin: 0, textTransform: "uppercase", letterSpacing: 0.3 }}>
        {title}
      </h1>
      <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 0" }}>{subtitle}</p>
    </div>
    {action}
  </div>
);

const EmptyState = ({ text }) => (
  <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: "40px 20px", textAlign: "center", color: C.mutedDim, fontSize: 13 }}>
    {text}
  </div>
);

/* ---------------------------------------------------------------------- */
/* TOP BAR — theme toggle, viewer switch, notifications                    */
/* ---------------------------------------------------------------------- */
function TopBar({ theme, setTheme, me, notifications, setNotifications }) {
  const [open, setOpen] = useState(false);
  const myNotifs = notifications.filter((n) => n.memberId === me?.id).sort((a, b) => b.createdAt - a.createdAt);
  const unread = myNotifs.filter((n) => !n.read).length;

  const markRead = (id) => {
    setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
    db.markNotificationRead(id).catch((e) => console.error(e));
  };

  return (
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginBottom: 18 }}>
      <div style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: C.text, fontWeight: 600 }}>{me?.name}</span>
        <span>({me?.role === "admin" ? "Admin" : "Atendimento"})</span>
      </div>
      <button
        onClick={() => supabase.auth.signOut()}
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        title="Sair"
      >
        <LogOut size={15} color={C.muted} />
      </button>

      <div style={{ position: "relative" }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}
        >
          <Bell size={15} color={C.muted} />
          {unread > 0 && (
            <span style={{ position: "absolute", top: -4, right: -4, background: C.red, color: "#fff", fontSize: 9.5, fontWeight: 700, borderRadius: 999, minWidth: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {unread}
            </span>
          )}
        </button>
        {open && (
          <div style={{ position: "absolute", right: 0, top: 40, width: 320, background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 10, boxShadow: "0 12px 30px rgba(0,0,0,.2)", zIndex: 40, maxHeight: 360, overflowY: "auto" }}>
            <div style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: C.mutedDim, textTransform: "uppercase", borderBottom: `1px solid ${C.border}` }}>
              Notificações de {me?.name}
            </div>
            {myNotifs.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: C.mutedDim }}>Nenhuma notificação.</div>}
            {myNotifs.map((n) => (
              <div key={n.id} style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, background: n.read ? "transparent" : C.brandDim }}>
                <div style={{ fontSize: 12.5, color: C.text }}>{n.message}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  {!n.read && (
                    <button onClick={() => markRead(n.id)} style={{ background: "none", border: "none", color: C.brand, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                      Marcar como lida
                    </button>
                  )}
                  {me?.email && (
                    <a
                      href={`mailto:${me.email}?subject=${encodeURIComponent("Coletivo — " + n.message)}&body=${encodeURIComponent(n.message)}`}
                      style={{ fontSize: 11, fontWeight: 600, color: C.muted, textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}
                    >
                      <Mail size={11} /> Abrir e-mail
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        title="Alternar tema"
      >
        {theme === "dark" ? <Sun size={15} color={C.muted} /> : <Moon size={15} color={C.muted} />}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* SIDEBAR                                                                  */
/* ---------------------------------------------------------------------- */
const NAV_ADMIN = [
  { id: "threads", label: "Threads", icon: Rss },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "dashboard", label: "Dashboard", icon: TrendingUp },
  { id: "alertas", label: "Alertas", icon: Bell },
  { id: "demandas", label: "Demandas", icon: ClipboardList },
  { id: "lembretes", label: "Lembretes", icon: MessageSquare },
  { id: "relatorios", label: "Relatórios", icon: FileText },
  { id: "reguas", label: "Réguas de comunicação", icon: Megaphone },
  { id: "equipe", label: "Equipe & Acessos", icon: UserCog },
];
const NAV_STAFF = [
  { id: "threads", label: "Threads", icon: Rss },
  { id: "demandas", label: "Minhas demandas", icon: ClipboardList },
  { id: "lembretes", label: "Lembretes", icon: MessageSquare },
];

function Sidebar({ tab, setTab, alertCount, demandCount, role, pendingByTab = {} }) {
  const nav = role === "admin" ? NAV_ADMIN : NAV_STAFF;
  return (
    <div style={{ width: 216, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`, padding: "22px 14px", display: "flex", flexDirection: "column", gap: 4, minHeight: "100%" }}>
      <style>{`@keyframes fluxo-bolt-blink { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px", marginBottom: 28 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: C.brand, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ring size={17} color="#FFFFFF" stroke={2.6} />
        </div>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 17, color: C.text, letterSpacing: 0.4, textTransform: "uppercase", lineHeight: 1 }}>
            Coletivo
          </div>
          <div style={{ fontSize: 10.5, color: C.mutedDim, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 2 }}>
            Fluxo de demandas
          </div>
        </div>
      </div>
      {nav.map((n) => {
        const Icon = n.icon;
        const active = tab === n.id;
        const count = n.id === "alertas" ? alertCount : n.id === "demandas" ? demandCount : 0;
        const pendingMsg = pendingByTab[n.id];
        return (
          <button
            key={n.id}
            onClick={() => setTab(n.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, border: "none",
              background: active ? C.surface3 : "transparent", color: active ? C.text : C.muted, cursor: "pointer",
              fontFamily: "Inter, sans-serif", fontSize: 13.5, fontWeight: active ? 600 : 500, textAlign: "left", width: "100%",
            }}
          >
            <Icon size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{n.label}</span>
            {pendingMsg && (
              <span title={pendingMsg} style={{ display: "flex", animation: "fluxo-bolt-blink 1.3s ease-in-out infinite", flexShrink: 0 }}>
                <Zap size={13} color={C.amber} fill={C.amber} />
              </span>
            )}
            {count > 0 && (
              <span style={{ background: n.id === "alertas" ? C.red : C.brand, color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 999, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
      {role !== "admin" && (
        <div style={{ marginTop: "auto", fontSize: 11, color: C.mutedDim, padding: 10, background: C.surface2, borderRadius: 8 }}>
          Perfil <b style={{ color: C.muted }}>Atendimento</b> — acesso limitado às suas demandas.
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* TEAM / ACCESS VIEW                                                      */
/* ---------------------------------------------------------------------- */
function AccessForm({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("atendimento");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await db.inviteTeamMember({ name: name.trim(), email: email.trim(), role });
      onSave({ id: res.id, name: name.trim(), email: email.trim(), role, status: "convite pendente" });
    } catch (e) {
      setError(e.message || "Não foi possível enviar o convite.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Novo acesso" onClose={onClose}>
      <Field label="Nome">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da pessoa" />
      </Field>
      <Field label="E-mail" hint="A pessoa recebe um e-mail do Supabase com um link para definir a própria senha.">
        <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@agenciacoletivo.com" />
      </Field>
      <Field label="Perfil de acesso">
        <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="atendimento">Atendimento — só vê e executa as demandas atribuídas a ela</option>
          <option value="admin">Admin (Gestor) — acesso completo</option>
        </select>
      </Field>
      {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn disabled={busy || !name.trim() || !email.trim()} onClick={handleCreate}>
          {busy ? "Enviando convite..." : "Convidar"}
        </Btn>
      </div>
    </Modal>
  );
}

function TeamView({ team, setTeam, demands, clients, onNotify }) {
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [msgDraft, setMsgDraft] = useState("");
  const toggleStatus = (id) => {
    const m = team.find((x) => x.id === id);
    const status = m.status === "ativo" ? "inativo" : "ativo";
    setTeam((t) => t.map((x) => (x.id === id ? { ...x, status } : x)));
    db.updateTeamMemberStatus(id, status).catch((e) => console.error(e));
  };
  const remove = (id) => {
    setTeam((t) => t.filter((m) => m.id !== id));
    db.deleteTeamMember(id).catch((e) => console.error(e));
  };

  return (
    <div>
      <ViewHeader
        title="Equipe & Acessos"
        subtitle="Perfis de acesso da Coletivo — consulte a fila de cada pessoa e notifique quando precisar"
        action={<Btn onClick={() => setShowForm(true)}><Plus size={15} /> Novo acesso</Btn>}
      />
      <div style={{ background: C.brandDim, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", fontSize: 12.5, color: C.text, marginBottom: 18, display: "flex", gap: 10 }}>
        <Lock size={15} color={C.brand} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Login real por e-mail e senha. A pessoa fica <b>convite pendente</b> até abrir o e-mail e definir a senha. O papel (Admin/Atendimento) define o que cada pessoa enxerga no menu.</span>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {team.map((m) => {
          const mine = demands.filter((d) => d.assigneeId === m.id);
          const open = mine.filter((d) => d.status !== "concluida");
          const isOpen = openId === m.id;
          return (
            <Ticket key={m.id} style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: 14, display: "flex", alignItems: "center", gap: 14, cursor: m.role === "atendimento" ? "pointer" : "default" }} onClick={() => m.role === "atendimento" && setOpenId(isOpen ? null : m.id)}>
                <div style={{ width: 36, height: 36, borderRadius: 999, background: m.role === "admin" ? C.brandDim : C.surface3, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: m.role === "admin" ? C.brand : C.muted, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, flexShrink: 0 }}>
                  {m.name.slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{m.email}</div>
                </div>
                {m.role === "atendimento" && (
                  <div style={{ fontSize: 11.5, color: C.muted, display: "flex", gap: 8 }}>
                    <span><b style={{ color: C.text }}>{open.length}</b> em aberto</span>
                    <span>·</span>
                    <span><b style={{ color: C.text }}>{mine.length}</b> no total</span>
                  </div>
                )}
                <Badge tone={m.role === "admin" ? "brand" : "muted"}>{m.role === "admin" ? "Admin" : "Atendimento"}</Badge>
                <Badge tone={m.status === "ativo" ? "teal" : m.status === "inativo" ? "red" : "amber"}>{m.status}</Badge>
                <Btn variant="ghost" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={(e) => { e.stopPropagation(); toggleStatus(m.id); }}>{m.status === "ativo" ? "Desativar" : "Ativar"}</Btn>
                <button onClick={(e) => { e.stopPropagation(); remove(m.id); }} style={{ background: "none", border: "none", color: C.mutedDim, cursor: "pointer" }}><Trash2 size={15} /></button>
                {m.role === "atendimento" && <ChevronRight size={16} color={C.muted} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />}
              </div>
              {isOpen && m.role === "atendimento" && (
                <div style={{ padding: "0 16px 16px 64px", borderTop: `1px solid ${C.border}` }}>
                  <div style={{ marginTop: 12, marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input style={{ ...inputStyle, flex: 1 }} placeholder="Mensagem para notificar agora" value={msgDraft} onChange={(e) => setMsgDraft(e.target.value)} />
                      <Btn onClick={() => { if (msgDraft.trim()) { onNotify(m.id, msgDraft.trim(), null); setMsgDraft(""); } }}><Send size={13} /> Notificar</Btn>
                    </div>
                  </div>
                  {mine.length === 0 && <div style={{ fontSize: 12, color: C.mutedDim }}>Nenhuma demanda atribuída ainda.</div>}
                  {mine.map((d) => (
                    <div key={d.id} style={{ fontSize: 12.5, color: C.text, padding: "6px 0", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <span>{d.title} <span style={{ color: C.muted }}>· {clients.find((c) => c.id === d.clientId)?.name}</span></span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <Badge tone={d.status === "concluida" ? "teal" : "muted"}>{STATUSES.find((s) => s.id === d.status)?.label}</Badge>
                        <button onClick={() => onNotify(m.id, `Lembrete sobre: "${d.title}"`, d.id)} style={{ background: "none", border: "none", color: C.brand, cursor: "pointer" }} title="Notificar sobre esta demanda">
                          <Send size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Ticket>
          );
        })}
      </div>
      {showForm && <AccessForm onClose={() => setShowForm(false)} onSave={(m) => { setTeam((t) => [...t, m]); setShowForm(false); }} />}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* COMMUNICATION RULES VIEW                                                */
/* ---------------------------------------------------------------------- */
function RuleForm({ team, themes, themeGroups, onManageTags, onSave, onClose }) {
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("dias_antes_prazo");
  const [daysBefore, setDaysBefore] = useState(2);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [statusAlvo, setStatusAlvo] = useState("aguardando");
  const [demandTypeFilter, setDemandTypeFilter] = useState("todos");
  const [recipientMode, setRecipientMode] = useState("responsavel");
  const [recipientId, setRecipientId] = useState(team.find((t) => t.role === "atendimento")?.id || "");
  const [message, setMessage] = useState('Lembrete: "{titulo}" ({cliente}) — prazo {prazo}.');
  const [action, setAction] = useState("notificacao");
  const [alertType, setAlertType] = useState("relatorio");
  const [alertTagIds, setAlertTagIds] = useState([]);
  const isTempoIndividual = trigger === "dias_antes_prazo" || trigger === "demanda_criada" || trigger === "status_mudou";
  const forceFixedRecipient = trigger === "dia_fixo_mes" || trigger === "alerta_disparado";

  return (
    <Modal title="Nova régua de comunicação" onClose={onClose} wide>
      <Field label="Nome da régua">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Aviso 2 dias antes do prazo" />
      </Field>
      <Field label="Gatilho">
        <select style={inputStyle} value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          <optgroup label="Por tempo">
            <option value="dias_antes_prazo">X dias antes do prazo</option>
            <option value="dia_fixo_mes">Dia fixo do mês</option>
          </optgroup>
          <optgroup label="Por ação">
            <option value="demanda_criada">Quando uma demanda é criada</option>
            <option value="status_mudou">Quando o status muda para...</option>
            <option value="alerta_disparado">Quando um alerta dispara</option>
          </optgroup>
        </select>
      </Field>

      {trigger === "dias_antes_prazo" && (
        <Field label="Quantos dias antes do prazo"><input type="number" style={inputStyle} value={daysBefore} onChange={(e) => setDaysBefore(e.target.value)} /></Field>
      )}
      {trigger === "dia_fixo_mes" && (
        <Field label="Dia do mês" hint="Ex: todo dia 1, notificar sobre pendências do mês."><input type="number" min={1} max={28} style={inputStyle} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} /></Field>
      )}
      {trigger === "status_mudou" && (
        <Field label="Quando o status mudar para">
          <select style={inputStyle} value={statusAlvo} onChange={(e) => setStatusAlvo(e.target.value)}>
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
      )}

      {isTempoIndividual && (
        <Field label="Aplicar a quais tipos de demanda">
          <select style={inputStyle} value={demandTypeFilter} onChange={(e) => setDemandTypeFilter(e.target.value)}>
            <option value="todos">Todos os tipos</option>
            {DEMAND_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
      )}

      <Field label="Quem recebe">
        {!forceFixedRecipient && (
          <select style={{ ...inputStyle, marginBottom: 8 }} value={recipientMode} onChange={(e) => setRecipientMode(e.target.value)}>
            <option value="responsavel">O responsável pela demanda</option>
            <option value="pessoa_especifica">Uma pessoa específica</option>
          </select>
        )}
        {(forceFixedRecipient || recipientMode === "pessoa_especifica") && (
          <select style={inputStyle} value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
            <option value="">— escolha —</option>
            {team.filter((t) => t.status === "ativo").map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </Field>

      <Field label="Mensagem" hint="Use {titulo}, {cliente} e {prazo} para preencher automaticamente (quando aplicável). Vira o título do alerta, se a ação abaixo for 'Criar alerta'.">
        <textarea style={{ ...inputStyle, minHeight: 60 }} value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>

      <Field label="Ação ao disparar">
        <select style={inputStyle} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="notificacao">Notificação simples</option>
          <option value="alerta">Criar Alerta (aparece em Novidades e, se Relatório, vira card em Demandas)</option>
        </select>
      </Field>
      {action === "alerta" && (
        <>
          <Field label="Tipo do alerta">
            <select style={inputStyle} value={alertType} onChange={(e) => setAlertType(e.target.value)}>
              <option value="relatorio">Relatório — precisa de comprovação</option>
              <option value="comunicacao">Comunicação — só avisa</option>
            </select>
          </Field>
          <Field label="Tema e assunto">
            <TagPicker themes={themes} themeGroups={themeGroups} selectedIds={alertTagIds} onToggle={(id) => setAlertTagIds((ts) => (ts.includes(id) ? ts.filter((t) => t !== id) : [...ts, id]))} />
            <button onClick={onManageTags} style={{ background: "none", border: "none", color: C.brand, fontSize: 11.5, fontWeight: 600, cursor: "pointer", marginTop: 6, padding: 0 }}>
              Gerenciar temas
            </button>
          </Field>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn
          disabled={!name.trim() || !message.trim() || (forceFixedRecipient && !recipientId) || (recipientMode === "pessoa_especifica" && !recipientId)}
          onClick={() => onSave({
            id: uid(), name: name.trim(), active: true, trigger, daysBefore: Number(daysBefore), dayOfMonth: Number(dayOfMonth),
            statusAlvo, demandTypeFilter, recipientMode: forceFixedRecipient ? "pessoa_especifica" : recipientMode, recipientId, message: message.trim(),
            action, alertType, alertTagIds,
          })}
        >
          Criar régua
        </Btn>
      </div>
    </Modal>
  );
}

function RulesView({ team, rules, setRules, themes, setThemes, themeGroups, setThemeGroups }) {
  const [showForm, setShowForm] = useState(false);
  const [showThemeManager, setShowThemeManager] = useState(false);
  const toggle = (id) => {
    const rule = { ...rules.find((r) => r.id === id), active: !rules.find((r) => r.id === id).active };
    setRules((rs) => rs.map((r) => (r.id === id ? rule : r)));
    db.updateRule(rule).catch((e) => console.error(e));
  };
  const remove = (id) => {
    setRules((rs) => rs.filter((r) => r.id !== id));
    db.deleteRule(id).catch((e) => console.error(e));
  };
  const memberName = (id) => team.find((t) => t.id === id)?.name;

  return (
    <div>
      <ViewHeader title="Réguas de comunicação" subtitle="Automatize alertas para a equipe — por tempo ou por ação, além dos disparos manuais" action={<Btn onClick={() => setShowForm(true)}><Plus size={15} /> Nova régua</Btn>} />
      {rules.length === 0 && <EmptyState text="Nenhuma régua criada. Disparos manuais continuam disponíveis em Equipe & Acessos e no quadro de Demandas." />}
      <div style={{ display: "grid", gap: 10 }}>
        {rules.map((r) => (
          <Ticket key={r.id} style={{ padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: r.trigger.includes("dia") ? C.brandDim : C.amberDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {r.trigger.startsWith("dia") ? <CalendarClock size={16} color={C.brand} /> : <Zap size={16} color={C.amber} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.name}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {triggerLabel(r.trigger)}
                {r.trigger === "dias_antes_prazo" && ` (${r.daysBefore} dias)`}
                {r.trigger === "dia_fixo_mes" && ` (dia ${r.dayOfMonth})`}
                {r.trigger === "status_mudou" && ` → ${STATUSES.find((s) => s.id === r.statusAlvo)?.label}`}
                {" · para "}{r.recipientMode === "responsavel" ? "responsável da demanda" : memberName(r.recipientId) || "—"}
              </div>
            </div>
            {r.action === "alerta" && <Badge tone="brand">Cria alerta</Badge>}
            <Badge tone={r.active ? "teal" : "muted"}>{r.active ? "Ativa" : "Pausada"}</Badge>
            <Btn variant="ghost" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={() => toggle(r.id)}>{r.active ? "Pausar" : "Ativar"}</Btn>
            <button onClick={() => remove(r.id)} style={{ background: "none", border: "none", color: C.mutedDim, cursor: "pointer" }}><Trash2 size={15} /></button>
          </Ticket>
        ))}
      </div>
      {showForm && (
        <RuleForm
          team={team} themes={themes} themeGroups={themeGroups} onManageTags={() => setShowThemeManager(true)}
          onClose={() => setShowForm(false)}
          onSave={(r) => { setRules((rs) => [...rs, r]); db.insertRule(r).catch((e) => console.error(e)); setShowForm(false); }}
        />
      )}
      {showThemeManager && <ThemeManager themeGroups={themeGroups} setThemeGroups={setThemeGroups} themes={themes} setThemes={setThemes} onClose={() => setShowThemeManager(false)} />}
    </div>
  );
}


function ClientForm({ team, onSave, onClose }) {
  const [name, setName] = useState("");
  const [units, setUnits] = useState([{ id: uid(), name: "" }]);
  const [portfolioOwnerId, setPortfolioOwnerId] = useState("");
  const [priority, setPriority] = useState([
    { metricId: "", rank: 1, thresh: "" },
    { metricId: "", rank: 2, thresh: "" },
    { metricId: "", rank: 3, thresh: "" },
  ]);
  const [deliverables, setDeliverables] = useState([{ id: uid(), type: DELIVERABLE_TYPES[0], freq: "Semanal" }]);
  const [diagnosis, setDiagnosis] = useState("");

  const updateUnit = (id, val) => setUnits((u) => u.map((x) => (x.id === id ? { ...x, name: val } : x)));
  const addUnit = () => setUnits((u) => [...u, { id: uid(), name: "" }]);
  const removeUnit = (id) => setUnits((u) => u.filter((x) => x.id !== id));
  const updatePriority = (idx, field, val) => setPriority((p) => p.map((x, i) => (i === idx ? { ...x, [field]: val } : x)));
  const addDeliverable = () => setDeliverables((d) => [...d, { id: uid(), type: DELIVERABLE_TYPES[0], freq: "Semanal" }]);
  const updateDeliverable = (id, field, val) => setDeliverables((d) => d.map((x) => (x.id === id ? { ...x, [field]: val } : x)));
  const removeDeliverable = (id) => setDeliverables((d) => d.filter((x) => x.id !== id));
  const canSave = name.trim() && units.some((u) => u.name.trim());

  const handleSave = () => {
    onSave({
      id: uid(),
      name: name.trim(),
      units: units.filter((u) => u.name.trim()).map((u) => ({ id: u.id, name: u.name.trim() })),
      portfolioOwnerId,
      priorityMetrics: priority.filter((p) => p.metricId).map((p) => ({ metricId: p.metricId, rank: p.rank, thresh: p.thresh ? Number(p.thresh) : metricById(p.metricId).defThresh })),
      deliverables,
      diagnosis: diagnosis.trim(),
      createdAt: Date.now(),
    });
  };

  return (
    <Modal title="Novo cliente · Briefing de diagnóstico" onClose={onClose} wide>
      <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
        <Field label="Nome do cliente">
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Tapí Tapioca" />
        </Field>
        <Field label="Unidades / lojas">
          {units.map((u, i) => (
            <div key={u.id} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input style={inputStyle} value={u.name} onChange={(e) => updateUnit(u.id, e.target.value)} placeholder={`Unidade ${i + 1} (ex: Ipanema)`} />
              {units.length > 1 && (
                <button onClick={() => removeUnit(u.id)} style={{ background: "none", border: "none", color: C.mutedDim, cursor: "pointer" }}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          <Btn variant="ghost" onClick={addUnit} style={{ marginTop: 2 }}><Plus size={14} /> Adicionar unidade</Btn>
        </Field>

        <Field label="Responsável pela carteira" hint="Quem gerencia esse cliente no dia a dia. Usado para nunca escalar essa mesma pessoa na revisão de usuário oculto deste cliente.">
          <select style={inputStyle} value={portfolioOwnerId} onChange={(e) => setPortfolioOwnerId(e.target.value)}>
            <option value="">— sem responsável definido —</option>
            {team.filter((t) => t.status === "ativo").map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>

        <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Target size={15} color={C.amber} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.3 }}>
              Critério principal de avaliação
            </span>
          </div>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 0, marginBottom: 14 }}>
            Até 3 indicadores prioritários. Os alertas automáticos vigiam estes indicadores com o limite abaixo (em branco = padrão do indicador).
          </p>
          {priority.map((p, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: C.surface3, color: C.amber, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "'Barlow Condensed', sans-serif" }}>
                {idx + 1}
              </span>
              <select style={{ ...inputStyle, flex: 2 }} value={p.metricId} onChange={(e) => updatePriority(idx, "metricId", e.target.value)}>
                <option value="">— indicador —</option>
                {METRICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <input style={{ ...inputStyle, flex: 1 }} type="number" placeholder={p.metricId ? `padrão ${metricById(p.metricId).defThresh}%` : "limite %"} value={p.thresh} onChange={(e) => updatePriority(idx, "thresh", e.target.value)} />
            </div>
          ))}
        </div>

        <Field label="Entregáveis e periodicidade">
          {deliverables.map((d) => (
            <div key={d.id} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <select style={{ ...inputStyle, flex: 2 }} value={d.type} onChange={(e) => updateDeliverable(d.id, "type", e.target.value)}>
                {DELIVERABLE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <select style={{ ...inputStyle, flex: 1 }} value={d.freq} onChange={(e) => updateDeliverable(d.id, "freq", e.target.value)}>
                {FREQS.map((f) => <option key={f}>{f}</option>)}
              </select>
              <button onClick={() => removeDeliverable(d.id)} style={{ background: "none", border: "none", color: C.mutedDim, cursor: "pointer" }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <Btn variant="ghost" onClick={addDeliverable}><Plus size={14} /> Adicionar entregável</Btn>
        </Field>

        <Field label="Diagnóstico / observações do briefing" hint="Contexto de negócio, metas, histórico.">
          <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Ex: Rede com 8 unidades, foco em recuperar conversão..." />
        </Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={!canSave}>Salvar cliente</Btn>
      </div>
    </Modal>
  );
}

/** Converte um link de pasta do Google Drive num link de embed (iframe). */
function driveEmbedUrl(url) {
  if (!url) return "";
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? `https://drive.google.com/embeddedfolderview?id=${match[1]}#grid` : "";
}

function DriveLinkField({ client, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(client.driveUrl || "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await db.updateClientDrive(client.id, value.trim());
      onSaved(value.trim());
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.mutedDim, textTransform: "uppercase", marginBottom: 6 }}>Pasta do Drive</div>
      {editing ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Cole o link de compartilhamento da pasta do Drive" value={value} onChange={(e) => setValue(e.target.value)} />
          <Btn disabled={busy} onClick={save}>Salvar</Btn>
          <Btn variant="ghost" onClick={() => { setEditing(false); setValue(client.driveUrl || ""); }}>Cancelar</Btn>
        </div>
      ) : client.driveUrl ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href={client.driveUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: C.brand, wordBreak: "break-all" }}>{client.driveUrl}</a>
          <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: C.mutedDim, cursor: "pointer", fontSize: 11.5 }}>editar</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: C.brand, cursor: "pointer", fontSize: 12.5, fontWeight: 600, padding: 0 }}>+ Adicionar link da pasta</button>
      )}
    </div>
  );
}

function ClientsView({ clients, setClients, team, themes, setThemes, themeGroups }) {
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const removeClient = (id) => {
    setClients((cs) => cs.filter((c) => c.id !== id));
    db.deleteClient(id).catch((e) => console.error(e));
  };
  const ownerName = (id) => team.find((t) => t.id === id)?.name;

  return (
    <div>
      <ViewHeader title="Clientes" subtitle="Cadastro e briefing de diagnóstico" action={<Btn onClick={() => setShowForm(true)}><Plus size={15} /> Novo cliente</Btn>} />
      {clients.length === 0 && <EmptyState text="Nenhum cliente cadastrado ainda." />}
      <div style={{ display: "grid", gap: 12 }}>
        {clients.map((c) => {
          const isOpen = expanded === c.id;
          return (
            <Ticket key={c.id} style={{ padding: 0, overflow: "hidden" }}>
              <div onClick={() => setExpanded(isOpen ? null : c.id)} style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
                <ChevronRight size={16} color={C.muted} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 19, fontWeight: 700, color: C.text, letterSpacing: 0.2 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <Store size={12} style={{ marginTop: 2 }} />
                    {c.units.map((u) => u.name).join(" · ")}
                    {c.portfolioOwnerId && <><span>·</span><span>Carteira: <b style={{ color: C.text }}>{ownerName(c.portfolioOwnerId)}</b></span></>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {c.priorityMetrics.map((p) => <Badge key={p.metricId} tone="amber">{metricById(p.metricId)?.label}</Badge>)}
                </div>
              </div>
              {isOpen && (
                <div style={{ padding: "0 18px 18px 48px", borderTop: `1px solid ${C.border}` }}>
                  {c.diagnosis && <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginTop: 14 }}>{c.diagnosis}</p>}
                  <div style={{ display: "flex", gap: 24, marginTop: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.mutedDim, textTransform: "uppercase", marginBottom: 6 }}>Critérios de alerta</div>
                      {c.priorityMetrics.map((p) => (
                        <div key={p.metricId} style={{ fontSize: 12.5, color: C.text, marginBottom: 3 }}>
                          <span style={{ color: C.amber, fontWeight: 700 }}>#{p.rank}</span> {metricById(p.metricId)?.label} — limite {p.thresh}%
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.mutedDim, textTransform: "uppercase", marginBottom: 6 }}>Entregáveis</div>
                      {c.deliverables.map((d) => (
                        <div key={d.id} style={{ fontSize: 12.5, color: C.text, marginBottom: 3 }}>{d.type} — <span style={{ color: C.muted }}>{d.freq}</span></div>
                      ))}
                    </div>
                  </div>
                  <DriveLinkField client={c} onSaved={(driveUrl) => setClients((cs) => cs.map((x) => (x.id === c.id ? { ...x, driveUrl } : x)))} />
                  <Btn variant="danger" style={{ marginTop: 14 }} onClick={() => removeClient(c.id)}><Trash2 size={13} /> Remover cliente</Btn>
                </div>
              )}
            </Ticket>
          );
        })}
      </div>
      {showForm && (
        <ClientForm
          team={team}
          onClose={() => setShowForm(false)}
          onSave={async (c) => {
            setClients((cs) => [...cs, c]);
            setShowForm(false);
            await db.insertClient(c).catch((e) => console.error(e));
            const clienteGroupId = themeGroups.find((g) => g.id === "grp-cliente")?.id || "grp-cliente";
            const theme = await db.syncClientTheme(c, clienteGroupId).catch((e) => { console.error(e); return null; });
            if (theme) setThemes((ts) => [...ts, theme]);
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* METRICS ENTRY VIEW                                                      */
/* ---------------------------------------------------------------------- */
function MetricsView({ clients, entries, setEntries }) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [unitId, setUnitId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [values, setValues] = useState({});
  const client = clients.find((c) => c.id === clientId);

  useEffect(() => {
    if (client && !client.units.find((u) => u.id === unitId)) setUnitId(client.units[0]?.id || "");
  }, [clientId]); // eslint-disable-line

  const unitEntries = entries.filter((e) => e.clientId === clientId && e.unitId === unitId).sort((a, b) => new Date(b.periodEnd) - new Date(a.periodEnd));

  const handleSave = () => {
    if (!clientId || !unitId || !periodEnd) return;
    const entry = { id: uid(), clientId, unitId, periodStart, periodEnd, metrics: { ...values }, createdAt: Date.now() };
    setEntries((es) => [...es, entry]);
    db.insertEntry(entry).catch((e) => console.error(e));
    setValues({});
    setPeriodStart("");
    setPeriodEnd("");
  };

  if (clients.length === 0) {
    return <div><ViewHeader title="Métricas" subtitle="Lançamento semanal por unidade" /><EmptyState text="Cadastre um cliente primeiro na aba Clientes." /></div>;
  }

  return (
    <div>
      <ViewHeader title="Métricas" subtitle="Lançamento manual por unidade e período" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 20 }}>
        <Ticket style={{ padding: 18 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}><Field label="Cliente"><select style={inputStyle} value={clientId} onChange={(e) => setClientId(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div>
            <div style={{ flex: 1 }}><Field label="Unidade"><select style={inputStyle} value={unitId} onChange={(e) => setUnitId(e.target.value)}>{client?.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field></div>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
            <div style={{ flex: 1 }}><Field label="Início do período"><input type="date" style={inputStyle} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></Field></div>
            <div style={{ flex: 1 }}><Field label="Fim do período"><input type="date" style={inputStyle} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></Field></div>
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {METRICS.map((m) => (
              <Field key={m.id} label={m.label}>
                <input type="number" style={inputStyle} value={values[m.id] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value }))} placeholder={m.fmt === "money" ? "R$" : m.fmt === "pct" ? "%" : "0"} />
              </Field>
            ))}
          </div>
          <Btn onClick={handleSave} style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>Salvar lançamento</Btn>
        </Ticket>

        <Ticket style={{ padding: 18 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: C.text, textTransform: "uppercase", marginBottom: 12 }}>
            Histórico — {client?.name} {client?.units.find((u) => u.id === unitId)?.name && `· ${client.units.find((u) => u.id === unitId).name}`}
          </div>
          {unitEntries.length === 0 && <EmptyState text="Nenhum lançamento para esta unidade ainda." />}
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {unitEntries.map((e) => (
              <div key={e.id} style={{ borderBottom: `1px solid ${C.border}`, padding: "10px 0" }}>
                <div style={{ fontSize: 12, color: C.muted, fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>{e.periodStart || "?"} → {e.periodEnd}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
                  {METRICS.filter((m) => e.metrics[m.id] !== undefined && e.metrics[m.id] !== "").map((m) => (
                    <div key={m.id} style={{ fontSize: 12 }}>
                      <span style={{ color: C.mutedDim }}>{m.label}:</span> <span style={{ color: C.text, fontFamily: "'JetBrains Mono', monospace" }}>{fmtVal(e.metrics[m.id], m.fmt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Ticket>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* ALERT ENGINE                                                            */
/* ---------------------------------------------------------------------- */
function computeAlerts(clients, entries) {
  const alerts = [];
  clients.forEach((client) => {
    client.units.forEach((unit) => {
      const list = entries.filter((e) => e.clientId === client.id && e.unitId === unit.id).sort((a, b) => new Date(a.periodEnd) - new Date(b.periodEnd));
      if (list.length < 2) return;
      const current = list[list.length - 1];
      const prevWoW = list[list.length - 2];
      const prevMoM = [...list].reverse().find((e) => e.id !== current.id && daysBetween(e.periodEnd, current.periodEnd) >= 24 && daysBetween(e.periodEnd, current.periodEnd) <= 40);
      const metricsToCheck = client.priorityMetrics.length > 0 ? client.priorityMetrics.map((p) => p.metricId) : METRICS.map((m) => m.id);

      metricsToCheck.forEach((metricId) => {
        const m = metricById(metricId);
        const prioCfg = client.priorityMetrics.find((p) => p.metricId === metricId);
        const threshold = prioCfg ? prioCfg.thresh : m.defThresh;
        const isPriority = !!prioCfg;

        [{ compare: prevWoW, label: "período anterior" }, { compare: prevMoM, label: "mesmo período mês anterior" }].forEach(({ compare, label }) => {
          if (!compare) return;
          const curVal = Number(current.metrics[metricId]);
          const prevVal = Number(compare.metrics[metricId]);
          if (!Number.isFinite(curVal) || !Number.isFinite(prevVal) || prevVal === 0) return;
          const pctChange = ((curVal - prevVal) / Math.abs(prevVal)) * 100;
          let triggered = false, direction = "";
          if (m.good === "up" && pctChange <= -threshold) { triggered = true; direction = "queda"; }
          else if (m.good === "down" && pctChange >= threshold) { triggered = true; direction = "subida"; }
          else if (m.good === "neutral" && Math.abs(pctChange) >= threshold) { triggered = true; direction = pctChange > 0 ? "subida" : "queda"; }

          if (triggered) {
            alerts.push({
              id: `${client.id}-${unit.id}-${metricId}-${label}`, clientId: client.id, clientName: client.name, unitId: unit.id, unitName: unit.name,
              metricId, metricLabel: m.label, pctChange, direction, basis: label, isPriority, curVal, prevVal, fmt: m.fmt, periodEnd: current.periodEnd,
            });
          }
        });
      });
    });
  });
  alerts.sort((a, b) => (b.isPriority - a.isPriority) || Math.abs(b.pctChange) - Math.abs(a.pctChange));
  return alerts;
}

function AlertsView({ clients, entries, onCreateDemand, demands, manualAlerts, manualAlertTags, themes, setThemes, themeGroups, setThemeGroups, team, me, onCreateAlert }) {
  const alerts = useMemo(() => computeAlerts(clients, entries), [clients, entries]);
  const insights = useMemo(() => computeCrossInsights(clients, entries), [clients, entries]);
  const existingAlertDemandKeys = new Set(demands.filter((d) => d.originAlertKey).map((d) => d.originAlertKey));
  const existingInsightKeys = new Set(demands.filter((d) => d.originInsightKey).map((d) => d.originInsightKey));

  return (
    <div>
      <ViewHeader title="Alertas" subtitle="Crie e acompanhe alertas manuais pra equipe, além das anomalias detectadas automaticamente" />
      <ManualAlertsSection
        alerts={manualAlerts} alertTags={manualAlertTags} themes={themes} setThemes={setThemes}
        themeGroups={themeGroups} setThemeGroups={setThemeGroups}
        clients={clients} team={team} me={me} demands={demands} onCreateAlert={onCreateAlert}
      />
      <ViewHeader title="Detectados automaticamente" subtitle="Variações fora da rotina, comparadas ao período anterior e ao mesmo período do mês anterior" />
      {alerts.length === 0 && <EmptyState text="Nenhum alerta no momento. Lance ao menos 2 períodos de métricas por unidade para o motor comparar." />}
      <div style={{ display: "grid", gap: 10, marginBottom: 26 }}>
        {alerts.map((a) => {
          const already = existingAlertDemandKeys.has(a.id);
          return (
            <Ticket key={a.id} style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: C.redDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {a.direction === "queda" ? <ArrowDownRight size={18} color={C.red} /> : <ArrowUpRight size={18} color={C.red} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{a.clientName} · {a.unitName}</span>
                  {a.isPriority && <Badge tone="amber">Prioritário</Badge>}
                  <Badge tone="muted">vs {a.basis}</Badge>
                </div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>
                  <b style={{ color: C.text }}>{a.metricLabel}</b> teve {a.direction} de <span style={{ color: C.red, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{a.pctChange > 0 ? "+" : ""}{a.pctChange.toFixed(1)}%</span> ({fmtVal(a.prevVal, a.fmt)} → {fmtVal(a.curVal, a.fmt)})
                </div>
              </div>
              <Btn
                variant={already ? "subtle" : "primary"}
                disabled={already}
                onClick={() => onCreateDemand({
                  id: uid(), title: `Investigar ${a.direction} de ${a.metricLabel} — ${a.unitName}`, clientId: a.clientId, unitId: a.unitId,
                  description: `${a.metricLabel} teve ${a.direction} de ${a.pctChange.toFixed(1)}% (${fmtVal(a.prevVal, a.fmt)} → ${fmtVal(a.curVal, a.fmt)}) comparado ao ${a.basis}.`,
                  priority: a.isPriority ? "urgente" : "normal", dueDate: "", status: "aberta", origin: "alerta", originAlertKey: a.id,
                  type: "geral", assigneeId: "", recurring: { enabled: false, freq: "" }, briefing: "", attachments: [], requiresProof: false, proofQuestion: "", proof: null, proofStatus: "pendente", actions: [], createdAt: Date.now(),
                })}
              >
                {already ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                {already ? "Demanda criada" : "Criar demanda"}
              </Btn>
            </Ticket>
          );
        })}
      </div>

      <ViewHeader title="Análises cruzadas" subtitle='Cruzamento automático de indicadores — "se visitas cresceram e vendas não, pode ser cardápio"' />
      {insights.length === 0 && <EmptyState text="Nenhuma leitura cruzada disponível ainda. Aparece quando os números de duas métricas relacionadas se movem de forma contraditória." />}
      <div style={{ display: "grid", gap: 10 }}>
        {insights.map((ins) => {
          const already = existingInsightKeys.has(ins.id);
          return (
            <Ticket key={ins.id} style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: C.brandDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Zap size={18} color={C.brand} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{ins.clientName} · {ins.unitName}</span>
                </div>
                <div style={{ fontSize: 13, color: C.text, marginTop: 3, fontWeight: 600 }}>{ins.title}</div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{ins.suggestion}</div>
              </div>
              <Btn
                variant={already ? "subtle" : "primary"}
                disabled={already}
                onClick={() => onCreateDemand({
                  id: uid(), title: ins.title + ` — ${ins.unitName}`, clientId: ins.clientId, unitId: ins.unitId,
                  description: ins.suggestion, priority: "normal", dueDate: "", status: "aberta", origin: "sistema", originInsightKey: ins.id,
                  type: "geral", assigneeId: "", recurring: { enabled: false, freq: "" }, briefing: "", attachments: [], requiresProof: false, proofQuestion: "", proof: null, proofStatus: "pendente", actions: [], createdAt: Date.now(),
                })}
              >
                {already ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                {already ? "Demanda criada" : "Criar demanda"}
              </Btn>
            </Ticket>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* DEMANDS VIEW (KANBAN)                                                   */
/* ---------------------------------------------------------------------- */
const STATUSES = [
  { id: "aberta", label: "Aberta" },
  { id: "andamento", label: "Em andamento" },
  { id: "aguardando", label: "Aguardando cliente" },
  { id: "concluida", label: "Concluída" },
];
const PRIORITIES = { urgente: C.red, normal: C.amber, baixa: C.brand };
const TYPE_TONE = { geral: "muted", cobranca: "amber", produto: "brand", dash_parcial: "teal", dash_consolidado: "teal", rotina_semanal: "brand", revisao_oculta: "amber" };

function DemandForm({ clients, team, onSave, onClose }) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [unitId, setUnitId] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [dueDate, setDueDate] = useState("");
  const [type, setType] = useState("geral");
  const [assigneeId, setAssigneeId] = useState("");
  const [recurFreq, setRecurFreq] = useState("Mensal");
  const [briefing, setBriefing] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [attName, setAttName] = useState("");
  const [attUrl, setAttUrl] = useState("");
  const [requiresProof, setRequiresProof] = useState(REQUIRES_PROOF_DEFAULT.geral);
  const [proofQuestion, setProofQuestion] = useState(PROOF_DEFAULTS.geral);

  const client = clients.find((c) => c.id === clientId);
  const staff = team.filter((t) => t.status === "ativo");
  const isDash = type === "dash_parcial" || type === "dash_consolidado";
  const effectiveDue = isDash ? nextFixedDashDate(type) : dueDate;

  const handleTypeChange = (t) => {
    setType(t);
    setRequiresProof(REQUIRES_PROOF_DEFAULT[t]);
    setProofQuestion(PROOF_DEFAULTS[t]);
  };

  const addAttachment = () => {
    if (!attUrl.trim()) return;
    setAttachments((a) => [...a, { id: uid(), name: attName.trim() || "Anexo", url: attUrl.trim() }]);
    setAttName(""); setAttUrl("");
  };

  return (
    <Modal title="Nova demanda" onClose={onClose} wide>
      <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
        <Field label="Título">
          <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Ajustar budget de anúncio" />
        </Field>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Field label="Cliente"><select style={inputStyle} value={clientId} onChange={(e) => setClientId(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div>
          <div style={{ flex: 1 }}><Field label="Unidade (opcional)"><select style={inputStyle} value={unitId} onChange={(e) => setUnitId(e.target.value)}><option value="">—</option>{client?.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field></div>
        </div>

        <Field label="Tipo de demanda">
          <select style={inputStyle} value={type} onChange={(e) => handleTypeChange(e.target.value)}>
            {DEMAND_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>

        {type === "cobranca" && (
          <Field label="Recorrência da cobrança" hint="Ao concluir, o sistema já cria a próxima ocorrência automaticamente.">
            <select style={inputStyle} value={recurFreq} onChange={(e) => setRecurFreq(e.target.value)}>
              {RECUR_FREQS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </Field>
        )}

        {type === "produto" && (
          <>
            <Field label="Briefing" hint="Descreva o que precisa ser criado (categoria, produto, textos).">
              <textarea style={{ ...inputStyle, minHeight: 70 }} value={briefing} onChange={(e) => setBriefing(e.target.value)} />
            </Field>
            <Field label="Anexos (fotos, referências, links de Drive)">
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Nome do anexo" value={attName} onChange={(e) => setAttName(e.target.value)} />
                <input style={{ ...inputStyle, flex: 2 }} placeholder="Link (Drive, Fotos, etc.)" value={attUrl} onChange={(e) => setAttUrl(e.target.value)} />
                <Btn variant="ghost" onClick={addAttachment}><Plus size={14} /></Btn>
              </div>
              {attachments.map((a) => (
                <div key={a.id} style={{ fontSize: 12, color: C.text, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Paperclip size={12} color={C.muted} /> {a.name} — <span style={{ color: C.brand }}>{a.url}</span>
                </div>
              ))}
            </Field>
          </>
        )}

        {isDash ? (
          <div style={{ fontSize: 12.5, color: C.muted, display: "flex", alignItems: "center", gap: 6, marginBottom: 14, background: C.surface2, borderRadius: 8, padding: "9px 11px" }}>
            <Lock size={13} /> Prazo automático: {effectiveDue} (dias 8, 15, 22 e dia 1 do mês seguinte)
          </div>
        ) : (
          <Field label="Descrição"><textarea style={{ ...inputStyle, minHeight: 60 }} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Field label="Prioridade">
              <select style={inputStyle} value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="urgente">Urgente</option><option value="normal">Normal</option><option value="baixa">Baixa</option>
              </select>
            </Field>
          </div>
          {!isDash && (
            <div style={{ flex: 1 }}><Field label="Prazo"><input type="date" style={inputStyle} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field></div>
          )}
        </div>

        <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: C.text, cursor: "pointer" }}>
            <input type="checkbox" checked={requiresProof} onChange={(e) => setRequiresProof(e.target.checked)} />
            Exigir comprovação para concluir (print/anexo ou resposta)
          </label>
          {requiresProof && (
            <div style={{ marginTop: 10 }}>
              <Field label="Pergunta de verificação" hint="Exibida para quem for concluir a demanda, junto do campo de anexo.">
                <input style={inputStyle} value={proofQuestion} onChange={(e) => setProofQuestion(e.target.value)} placeholder="Ex: Anexou o print da conversa com o cliente?" />
              </Field>
            </div>
          )}
        </div>

        <Field label="Responsável (Atendimento)" hint="A pessoa selecionada recebe notificação na plataforma e um link pronto de e-mail.">
          <select style={inputStyle} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">— não atribuído —</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role === "admin" ? "Admin" : "Atendimento"})</option>)}
          </select>
        </Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn
          disabled={!title.trim() || !clientId}
          onClick={() => onSave({
            id: uid(), title: title.trim(), clientId, unitId, description, priority, dueDate: isDash ? effectiveDue : dueDate,
            status: "aberta", origin: "manual", type, assigneeId, recurring: { enabled: type === "cobranca", freq: recurFreq },
            briefing, attachments, requiresProof, proofQuestion, proof: null, proofStatus: "pendente", actions: [], createdAt: Date.now(),
          })}
        >
          Criar demanda
        </Btn>
      </div>
    </Modal>
  );
}

function DemandCard({ demand, client, team, onUpdate, onDelete, onNotify, role, tags = [], themeGroups = [] }) {
  const [showAction, setShowAction] = useState(false);
  const [actionType, setActionType] = useState("");
  const [actionDesc, setActionDesc] = useState("");
  const [obsDraft, setObsDraft] = useState(demand.observation || "");
  const [showProofForm, setShowProofForm] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [proofAnswer, setProofAnswer] = useState("");
  const unit = client?.units.find((u) => u.id === demand.unitId);
  const assignee = team.find((t) => t.id === demand.assigneeId);
  const isDash = demand.type === "dash_parcial" || demand.type === "dash_consolidado";
  const proofSatisfied = !demand.requiresProof || ["enviada", "aprovada"].includes(demand.proofStatus);

  const addAction = () => {
    if (!actionDesc.trim()) return;
    onUpdate({ ...demand, actions: [...demand.actions, { id: uid(), type: actionType || "Ação", description: actionDesc.trim(), date: new Date().toISOString().slice(0, 10) }] });
    setActionDesc(""); setActionType(""); setShowAction(false);
  };

  const toggleChecklist = (clientId) => {
    onUpdate({ ...demand, checklist: demand.checklist.map((c) => (c.clientId === clientId ? { ...c, checked: !c.checked } : c)) });
  };

  const handleStatusChange = (newStatus) => {
    if (newStatus === "concluida" && demand.requiresProof && !proofSatisfied) {
      setShowProofForm(true);
      return;
    }
    onUpdate({ ...demand, status: newStatus });
  };

  const submitProof = () => {
    if (!proofUrl.trim() && !proofAnswer.trim()) return;
    onUpdate({
      ...demand, status: "concluida", proofStatus: "enviada",
      proof: { attachmentUrl: proofUrl.trim(), answer: proofAnswer.trim(), submittedAt: todayStr() },
    });
    setShowProofForm(false); setProofUrl(""); setProofAnswer("");
  };

  const approveProof = () => onUpdate({ ...demand, proofStatus: "aprovada" });
  const reproveProof = () => onUpdate({ ...demand, status: "andamento", proofStatus: "reprovada", reviewNote: "Reprovado pelo gestor — refazer e reenviar comprovação." });

  return (
    <Ticket style={{ padding: 13, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{demand.title}</div>
        <button onClick={() => onDelete(demand.id)} style={{ background: "none", border: "none", color: C.mutedDim, cursor: "pointer", flexShrink: 0 }}><X size={14} /></button>
      </div>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>{client?.name}{unit ? ` · ${unit.name}` : ""}</div>
      {demand.description && <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.4 }}>{demand.description}</div>}
      {demand.briefing && <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.4, fontStyle: "italic" }}>"{demand.briefing}"</div>}
      {demand.attachments?.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {demand.attachments.map((a) => (
            <a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: C.brand, display: "flex", alignItems: "center", gap: 4, textDecoration: "none", marginBottom: 2 }}>
              <Paperclip size={11} /> {a.name}
            </a>
          ))}
        </div>
      )}

      {demand.type === "rotina_semanal" && demand.checklist?.length > 0 && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          {demand.checklist.map((c) => (
              <label key={c.clientId} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: c.checked ? C.mutedDim : C.text, marginBottom: 4, cursor: "pointer", textDecoration: c.checked ? "line-through" : "none" }}>
                <input type="checkbox" checked={c.checked} onChange={() => toggleChecklist(c.clientId)} />
                {c.clientName || "Cliente"}
              </label>
          ))}
        </div>
      )}

      {demand.type === "revisao_oculta" && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          <Badge tone="brand">{demand.platform}</Badge>
          <textarea
            style={{ ...inputStyle, marginTop: 8, fontSize: 12, minHeight: 60 }}
            placeholder="O que observou nessa revisão? (cardápio, fotos, preço, tempo de entrega...)"
            value={obsDraft}
            onChange={(e) => setObsDraft(e.target.value)}
            onBlur={() => onUpdate({ ...demand, observation: obsDraft })}
          />
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Badge tone={TYPE_TONE[demand.type] || "muted"}>{demandTypeLabel(demand.type)}</Badge>
        {demand.alertId && <Badge tone="brand">Alerta</Badge>}
        {tags.map((t) => <Badge key={t.id} tone={resolveTone(t, themeGroups)}>{t.name}</Badge>)}
        <span style={{ fontSize: 10.5, fontWeight: 700, color: PRIORITIES[demand.priority], border: `1px solid ${PRIORITIES[demand.priority]}`, borderRadius: 999, padding: "2px 7px", textTransform: "uppercase" }}>
          {demand.priority}
        </span>
        {demand.dueDate && (
          <span style={{ fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 3 }}>
            {isDash ? <Lock size={11} /> : <Clock size={11} />} {demand.dueDate}
          </span>
        )}
        {demand.recurring?.enabled && <Badge tone="amber"><span style={{ display: "flex", alignItems: "center", gap: 3 }}><Repeat size={10} />{demand.recurring.freq}</span></Badge>}
        {demand.origin === "alerta" && <Badge tone="red">Alerta</Badge>}
        {demand.origin === "sistema" && <Badge tone="teal">Automático</Badge>}
        {demand.requiresProof && demand.proofStatus === "enviada" && <Badge tone="amber">Aguardando verificação</Badge>}
        {demand.requiresProof && demand.proofStatus === "aprovada" && <Badge tone="teal">Comprovação aprovada</Badge>}
        {demand.requiresProof && demand.proofStatus === "reprovada" && <Badge tone="red">Reprovada — refazer</Badge>}
      </div>

      {demand.proofStatus === "reprovada" && demand.reviewNote && (
        <div style={{ marginTop: 6, fontSize: 11.5, color: C.red }}>{demand.reviewNote}</div>
      )}

      {demand.proof && (demand.proof.attachmentUrl || demand.proof.answer) && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 8, fontSize: 11.5 }}>
          <div style={{ color: C.mutedDim, fontWeight: 700, textTransform: "uppercase", fontSize: 10.5, marginBottom: 3 }}>Comprovação enviada</div>
          {demand.proof.attachmentUrl && (
            <a href={demand.proof.attachmentUrl} target="_blank" rel="noreferrer" style={{ color: C.brand, display: "flex", alignItems: "center", gap: 4, textDecoration: "none", marginBottom: 2 }}>
              <Paperclip size={11} /> {demand.proof.attachmentUrl}
            </a>
          )}
          {demand.proof.answer && <div style={{ color: C.text }}>{demandTypeLabel(demand.type) && demand.proofQuestion ? `"${demand.proofQuestion}" → ` : ""}{demand.proof.answer}</div>}
          {role === "admin" && demand.proofStatus === "enviada" && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <Btn style={{ fontSize: 11.5, padding: "6px 10px" }} onClick={approveProof}><CheckCircle2 size={12} /> Aprovar</Btn>
              <Btn variant="danger" style={{ fontSize: 11.5, padding: "6px 10px" }} onClick={reproveProof}>Reprovar</Btn>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 11.5, color: C.muted, display: "flex", alignItems: "center", gap: 8 }}>
        <span>Responsável: <b style={{ color: assignee ? C.text : C.mutedDim }}>{assignee ? assignee.name : "não atribuído"}</b></span>
        {onNotify && assignee && (
          <button onClick={onNotify} style={{ background: "none", border: "none", color: C.brand, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontSize: 11 }} title="Notificar responsável">
            <Send size={11} /> Notificar
          </button>
        )}
      </div>

      {demand.actions.length > 0 && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          {demand.actions.map((a) => (
            <div key={a.id} style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>
              <span style={{ color: C.teal, fontFamily: "'JetBrains Mono', monospace" }}>{a.date}</span> · <b style={{ color: C.text }}>{a.type}</b> — {a.description}
            </div>
          ))}
        </div>
      )}

      {showAction ? (
        <div style={{ marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          <input style={{ ...inputStyle, marginBottom: 6, fontSize: 12 }} placeholder="Tipo de ação (ex: Ajuste de budget, Ativação Hits)" value={actionType} onChange={(e) => setActionType(e.target.value)} />
          <textarea style={{ ...inputStyle, marginBottom: 6, fontSize: 12, minHeight: 50 }} placeholder="Descrição da ação realizada" value={actionDesc} onChange={(e) => setActionDesc(e.target.value)} />
          <div style={{ display: "flex", gap: 6 }}>
            <Btn style={{ fontSize: 11.5, padding: "6px 10px" }} onClick={addAction}>Salvar</Btn>
            <Btn variant="ghost" style={{ fontSize: 11.5, padding: "6px 10px" }} onClick={() => setShowAction(false)}>Cancelar</Btn>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAction(true)} style={{ background: "none", border: "none", color: C.brand, fontSize: 11.5, fontWeight: 600, cursor: "pointer", marginTop: 8, padding: 0 }}>
          + Registrar ação
        </button>
      )}

      {showProofForm && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 8, background: C.surface2, borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <Paperclip size={12} /> Comprovação necessária para concluir
          </div>
          {demand.proofQuestion && <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{demand.proofQuestion}</div>}
          <input style={{ ...inputStyle, marginBottom: 6, fontSize: 12 }} placeholder="Link do print/anexo (Drive, Fotos, etc.)" value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} />
          <textarea style={{ ...inputStyle, marginBottom: 6, fontSize: 12, minHeight: 50 }} placeholder="Resposta / confirmação" value={proofAnswer} onChange={(e) => setProofAnswer(e.target.value)} />
          <div style={{ display: "flex", gap: 6 }}>
            <Btn style={{ fontSize: 11.5, padding: "6px 10px" }} onClick={submitProof}>Enviar e concluir</Btn>
            <Btn variant="ghost" style={{ fontSize: 11.5, padding: "6px 10px" }} onClick={() => setShowProofForm(false)}>Cancelar</Btn>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <select style={{ ...inputStyle, fontSize: 11.5, padding: "6px 8px" }} value={demand.status} onChange={(e) => handleStatusChange(e.target.value)}>
          {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
    </Ticket>
  );
}

function DemandsView({ clients, demands, setDemands, team, notifications, setNotifications, currentUserId, role, rules, themes = [], themeGroups = [], manualAlertTags = [], onCreateAlert }) {
  const dispatchRuleAlerts = (alertsToCreate) => {
    alertsToCreate.forEach(({ tagIds, ...alertRow }) => onCreateAlert?.(alertRow, tagIds).catch((e) => console.error(e)));
  };
  const [showForm, setShowForm] = useState(false);
  const [filterTag, setFilterTag] = useState("");
  const [filterPerson, setFilterPerson] = useState("");

  const tagsByAlert = useMemo(() => {
    const map = {};
    manualAlertTags.forEach((r) => {
      if (!map[r.alertId]) map[r.alertId] = [];
      map[r.alertId].push(r.themeId);
    });
    return map;
  }, [manualAlertTags]);

  // Grava as notificações no banco (dispara o e-mail de alerta via Database
  // Webhook -> Edge Function send-alert-email). Só é chamada depois que a
  // demanda referenciada já existe no banco, pra não violar a FK.
  const pushNotifications = (notifs) => {
    if (!notifs.length) return;
    setNotifications((ns) => [...ns, ...notifs]);
    db.insertNotifications(notifs).catch((e) => console.error(e));
  };
  const pushNotification = (memberId, message, demandId) => {
    if (!memberId) return;
    pushNotifications([{ id: uid(), memberId, message, demandId, read: false, createdAt: Date.now() }]);
  };

  const update = (d) => {
    const prev = demands.find((x) => x.id === d.id);
    setDemands((ds) => ds.map((x) => (x.id === d.id ? d : x)));
    db.updateDemand(d).catch((e) => console.error(e));

    const client = clients.find((c) => c.id === d.clientId);
    if (prev && prev.status !== d.status) {
      const { notifs, alertsToCreate } = evaluateActionRules(rules, "status_mudou", d, client, { newStatus: d.status }, currentUserId);
      pushNotifications(notifs);
      if (alertsToCreate.length) dispatchRuleAlerts(alertsToCreate);
    }
    if (prev && prev.proofStatus !== "reprovada" && d.proofStatus === "reprovada") {
      pushNotification(d.assigneeId, `Comprovação reprovada: refaça "${d.title}" e reenvie.`, d.id);
    }
    // spawn next occurrence for recurring cobrança demands
    if (prev && prev.status !== "concluida" && d.status === "concluida" && d.type === "cobranca" && d.recurring?.enabled) {
      const nextDue = addInterval(d.dueDate, d.recurring.freq);
      const clone = { ...d, id: uid(), status: "aberta", dueDate: nextDue, actions: [], proof: null, proofStatus: "pendente", createdAt: Date.now() };
      setDemands((ds) => [...ds, clone]);
      db.insertDemand(clone)
        .then(() => pushNotification(d.assigneeId, `Nova cobrança recorrente: "${d.title}" — prazo ${nextDue}`, clone.id))
        .catch((e) => console.error(e));
    }
    // card de Alerta concluído: a notificação de sino correspondente "sai"
    // (marca como lida), e — se o alerta era recorrente — nasce a próxima
    // ocorrência só pra essa pessoa (recorrência por pessoa).
    if (prev && prev.status !== "concluida" && d.status === "concluida" && d.alertId) {
      const notif = notifications.find((n) => n.demandId === d.id && n.memberId === d.assigneeId);
      if (notif && !notif.read) {
        setNotifications((ns) => ns.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
        db.markNotificationRead(notif.id).catch((e) => console.error(e));
      }
      if (d.recurring?.enabled) {
        const nextDue = addAlertInterval(d.dueDate, d.recurring.freq);
        const clone = { ...d, id: uid(), status: "aberta", dueDate: nextDue, actions: [], proof: null, proofStatus: "pendente", createdAt: Date.now() };
        setDemands((ds) => [...ds, clone]);
        db.insertDemand(clone)
          .then(() => pushNotification(d.assigneeId, `Alerta: "${d.title}"`, clone.id))
          .catch((e) => console.error(e));
      }
    }
  };
  const remove = (id) => {
    setDemands((ds) => ds.filter((x) => x.id !== id));
    db.deleteDemand(id).catch((e) => console.error(e));
  };

  const generateDashes = () => {
    const created = generateDashDemandsForMonth(clients, demands);
    if (created.length) {
      setDemands((ds) => [...ds, ...created]);
      db.insertDemands(created).catch((e) => console.error(e));
    }
  };

  const generateRoutines = () => {
    const weekly = generateWeeklyRoutine(clients, team, demands);
    const daily = generateDailyMysteryReview(clients, team, demands);
    const created = [...weekly, ...daily];
    if (created.length) {
      setDemands((ds) => [...ds, ...created]);
      db.insertDemands(created)
        .then(() => pushNotifications(created.filter((d) => d.assigneeId).map((d) => ({ id: uid(), memberId: d.assigneeId, message: `Rotina do dia: "${d.title}"`, demandId: d.id, read: false, createdAt: Date.now() }))))
        .catch((e) => console.error(e));
    }
  };

  const saveNew = (d) => {
    setDemands((ds) => [...ds, d]);
    setShowForm(false);
    db.insertDemand(d)
      .then(() => {
        const client = clients.find((c) => c.id === d.clientId);
        const { notifs, alertsToCreate } = evaluateActionRules(rules, "demanda_criada", d, client, {}, currentUserId);
        if (d.assigneeId) notifs.push({ id: uid(), memberId: d.assigneeId, message: `Nova demanda atribuída: "${d.title}"${d.dueDate ? " — prazo " + d.dueDate : ""}`, demandId: d.id, read: false, createdAt: Date.now() });
        pushNotifications(notifs);
        if (alertsToCreate.length) dispatchRuleAlerts(alertsToCreate);
      })
      .catch((e) => console.error(e));
  };

  const notifyAboutDemand = (d) => {
    if (!d.assigneeId) return;
    const client = clients.find((c) => c.id === d.clientId);
    pushNotification(d.assigneeId, `Lembrete de ${role === "admin" ? "gestão" : "equipe"}: "${d.title}" (${client?.name})`, d.id);
  };

  let visibleDemands = role === "admin" ? demands : demands.filter((d) => d.assigneeId === currentUserId);
  if (role === "admin" && filterTag) visibleDemands = visibleDemands.filter((d) => (tagsByAlert[d.alertId] || []).includes(filterTag));
  if (role === "admin" && filterPerson) visibleDemands = visibleDemands.filter((d) => d.assigneeId === filterPerson);

  return (
    <div>
      <ViewHeader
        title={role === "admin" ? "Demandas" : "Minhas demandas"}
        subtitle="Fluxo de atendimento — do alerta ou pedido até a conclusão"
        action={
          role === "admin" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={generateRoutines}><CalendarClock size={14} /> Gerar rotina de hoje</Btn>
              <Btn variant="ghost" onClick={generateDashes}><Repeat size={14} /> Gerar Dash do mês</Btn>
              <Btn onClick={() => setShowForm(true)} disabled={clients.length === 0}><Plus size={15} /> Nova demanda</Btn>
            </div>
          ) : null
        }
      />
      {clients.length === 0 && role === "admin" && (
        <div style={{ fontSize: 12, color: C.mutedDim, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Zap size={12} color={C.amber} fill={C.amber} /> Cadastre seu primeiro cliente pela aba Clientes no menu pra começar a criar demandas.
        </div>
      )}
      {role === "admin" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <select style={{ ...inputStyle, width: "auto" }} value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
            <option value="">Todas as tags</option>
            {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select style={{ ...inputStyle, width: "auto" }} value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)}>
            <option value="">Todas as pessoas</option>
            {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {STATUSES.map((s) => {
          const items = visibleDemands.filter((d) => d.status === s.id);
          return (
            <div key={s.id}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10, display: "flex", justifyContent: "space-between", borderBottom: `2px solid ${C.border}`, paddingBottom: 8 }}>
                {s.label} <span style={{ color: C.mutedDim }}>{items.length}</span>
              </div>
              {items.map((d) => (
                <DemandCard
                  key={d.id} demand={d} client={clients.find((c) => c.id === d.clientId)} team={team}
                  onUpdate={update} onDelete={remove} onNotify={role === "admin" ? () => notifyAboutDemand(d) : null} role={role}
                  tags={(tagsByAlert[d.alertId] || []).map((tid) => themes.find((t) => t.id === tid)).filter(Boolean)}
                  themeGroups={themeGroups}
                />
              ))}
            </div>
          );
        })}
      </div>
      {showForm && <DemandForm clients={clients} team={team} onClose={() => setShowForm(false)} onSave={saveNew} />}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* REMINDERS VIEW                                                          */
/* ---------------------------------------------------------------------- */
const REMINDER_TEMPLATES = {
  prazo: (client, unit) => `Olá! Passando para lembrar que temos um prazo se aproximando referente a ${client}${unit ? " (" + unit + ")" : ""}. Podemos alinhar os próximos passos?`,
  documento: (client, unit) => `Olá! Ainda estamos aguardando um documento/informação pendente de ${client}${unit ? " (" + unit + ")" : ""} para darmos sequência. Consegue nos enviar?`,
  semresposta: (client, unit) => `Olá! Notamos que ainda não tivemos retorno sobre nosso último contato referente a ${client}${unit ? " (" + unit + ")" : ""}. Fico à disposição para qualquer dúvida.`,
  relatorio: (client, unit) => `Olá! Está na hora de enviarmos o relatório de performance de ${client}${unit ? " (" + unit + ")" : ""}. Em breve enviamos os números atualizados.`,
  cobranca: (client, unit) => `Olá! Passando para lembrar sobre um pagamento em aberto referente a ${client}${unit ? " (" + unit + ")" : ""}. Qualquer dúvida, estou à disposição.`,
};
const REMINDER_LABELS = { prazo: "Prazo se aproximando", documento: "Documento/informação pendente", semresposta: "Cliente sem resposta", relatorio: "Envio de relatório", cobranca: "Cobrança" };

function RemindersView({ clients }) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [unitId, setUnitId] = useState("");
  const [type, setType] = useState("prazo");
  const [copied, setCopied] = useState(false);
  const client = clients.find((c) => c.id === clientId);
  const unit = client?.units.find((u) => u.id === unitId);
  const text = client ? REMINDER_TEMPLATES[type](client.name, unit?.name) : "";
  const copy = () => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  if (clients.length === 0) {
    return <div><ViewHeader title="Lembretes" subtitle="Textos prontos para WhatsApp e e-mail" /><EmptyState text="Cadastre um cliente primeiro." /></div>;
  }

  return (
    <div>
      <ViewHeader title="Lembretes" subtitle="Gere o texto — o envio continua manual, por WhatsApp ou e-mail" />
      <Ticket style={{ padding: 18, maxWidth: 560 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Field label="Cliente"><select style={inputStyle} value={clientId} onChange={(e) => setClientId(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div>
          <div style={{ flex: 1 }}><Field label="Unidade (opcional)"><select style={inputStyle} value={unitId} onChange={(e) => setUnitId(e.target.value)}><option value="">—</option>{client?.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field></div>
        </div>
        <Field label="Motivo do lembrete">
          <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>{Object.keys(REMINDER_LABELS).map((k) => <option key={k} value={k}>{REMINDER_LABELS[k]}</option>)}</select>
        </Field>
        <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, fontSize: 13, color: C.text, lineHeight: 1.5, marginTop: 4 }}>{text}</div>
        <Btn onClick={copy} style={{ marginTop: 12 }}><Copy size={13} /> {copied ? "Copiado!" : "Copiar texto"}</Btn>
      </Ticket>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* REPORTS VIEW                                                            */
/* ---------------------------------------------------------------------- */
function ReportsView({ clients, entries, demands }) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const client = clients.find((c) => c.id === clientId);

  if (clients.length === 0) {
    return <div><ViewHeader title="Relatórios" subtitle="Dashboard de performance no formato usado com os clientes" /><EmptyState text="Cadastre um cliente primeiro." /></div>;
  }

  const clientEntries = entries.filter((e) => e.clientId === clientId);
  const clientActions = demands.filter((d) => d.clientId === clientId).flatMap((d) => d.actions.map((a) => ({ ...a, unitName: client.units.find((u) => u.id === d.unitId)?.name || "—" }))).sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div>
      <ViewHeader
        title="Relatórios"
        subtitle="Gerado a partir dos lançamentos de métricas e do log de ações"
        action={<select style={{ ...inputStyle, width: 220 }} value={clientId} onChange={(e) => setClientId(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      />
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: C.text, textTransform: "uppercase", marginBottom: 10 }}>Drive do cliente</div>
      {client.driveUrl ? (
        <Ticket style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
          <iframe title={`Drive — ${client.name}`} src={driveEmbedUrl(client.driveUrl)} style={{ width: "100%", height: 420, border: "none", display: "block" }} />
        </Ticket>
      ) : (
        <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: "24px 20px", textAlign: "center", color: C.mutedDim, fontSize: 13, marginBottom: 20 }}>
          Nenhuma pasta do Drive vinculada ainda. Adicione o link em <b style={{ color: C.muted }}>Clientes</b>, no cadastro deste cliente.
        </div>
      )}

      <Ticket style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ background: C.brandDim, padding: "12px 18px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, color: C.brandSoft, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 9 }}>
          <Ring size={16} color={C.brandSoft} stroke={2.6} /> Dashboard de performance — {client.name}
        </div>
        {client.units.map((unit) => {
          const list = clientEntries.filter((e) => e.unitId === unit.id).sort((a, b) => new Date(a.periodEnd) - new Date(b.periodEnd));
          const current = list[list.length - 1];
          const prev = list[list.length - 2];
          return (
            <div key={unit.id} style={{ padding: "14px 18px", borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8, textTransform: "uppercase" }}>Unidade: {unit.name}</div>
              {!current ? <div style={{ fontSize: 12, color: C.mutedDim }}>Sem lançamentos.</div> : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead><tr style={{ color: C.mutedDim, textAlign: "left" }}><th style={{ padding: "4px 8px", fontWeight: 600 }}>Métrica</th><th style={{ padding: "4px 8px", fontWeight: 600 }}>Anterior</th><th style={{ padding: "4px 8px", fontWeight: 600 }}>Atual</th><th style={{ padding: "4px 8px", fontWeight: 600 }}>Evolução</th></tr></thead>
                    <tbody>
                      {METRICS.map((m) => {
                        const curV = current.metrics[m.id];
                        const prevV = prev?.metrics[m.id];
                        let pct = null;
                        if (curV !== undefined && curV !== "" && prevV !== undefined && prevV !== "" && Number(prevV) !== 0) pct = ((Number(curV) - Number(prevV)) / Math.abs(Number(prevV))) * 100;
                        return (
                          <tr key={m.id} style={{ borderTop: `1px solid ${C.border}` }}>
                            <td style={{ padding: "5px 8px", color: C.muted }}>{m.label}</td>
                            <td style={{ padding: "5px 8px", fontFamily: "'JetBrains Mono', monospace", color: C.mutedDim }}>{prev ? fmtVal(prevV, m.fmt) : "—"}</td>
                            <td style={{ padding: "5px 8px", fontFamily: "'JetBrains Mono', monospace", color: C.text, fontWeight: 700 }}>{fmtVal(curV, m.fmt)}</td>
                            <td style={{ padding: "5px 8px", fontFamily: "'JetBrains Mono', monospace" }}>{pct === null ? "—" : <span style={{ color: pct > 0 ? C.teal : pct < 0 ? C.red : C.muted }}>{pct > 0 ? "+" : ""}{pct.toFixed(1)}%</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </Ticket>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: C.text, textTransform: "uppercase", marginBottom: 10 }}>Atualizações / log de ações</div>
      {clientActions.length === 0 && <EmptyState text="Nenhuma ação registrada ainda para este cliente." />}
      <Ticket style={{ padding: 0, overflow: "hidden" }}>
        {clientActions.map((a, i) => (
          <div key={i} style={{ padding: "10px 16px", borderTop: i ? `1px solid ${C.border}` : "none", display: "flex", gap: 12, alignItems: "baseline" }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: C.teal, minWidth: 76 }}>{a.date}</span>
            <span style={{ fontSize: 12, color: C.muted, minWidth: 90 }}>{a.unitName}</span>
            <span style={{ fontSize: 12.5, color: C.text }}><b>{a.type}</b> — {a.description}</span>
          </div>
        ))}
      </Ticket>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* APP                                                                      */
/* ---------------------------------------------------------------------- */
export default function App() {
  const { session, loading: sessionLoading, authEvent } = useSession();
  const [theme, setTheme] = useState(() => localStorage.getItem("coletivo-fluxo:theme") || "light");
  const [tab, setTab] = useState("threads");
  const [myProfile, setMyProfile] = useState(null);
  const [clients, setClients] = useState([]);
  const [entries, setEntries] = useState([]);
  const [demands, setDemands] = useState([]);
  const [team, setTeam] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [communicationRules, setCommunicationRules] = useState([]);
  const [ruleFireLog, setRuleFireLog] = useState([]);
  const [themes, setThemes] = useState([]);
  const [themeGroups, setThemeGroups] = useState([]);
  const [posts, setPosts] = useState([]);
  const [postRecipients, setPostRecipients] = useState([]);
  const [postTags, setPostTags] = useState([]);
  const [postReads, setPostReads] = useState([]);
  const [postReplies, setPostReplies] = useState([]);
  const [postLikes, setPostLikes] = useState([]);
  const [dmConversations, setDmConversations] = useState([]);
  const [manualAlerts, setManualAlerts] = useState([]);
  const [manualAlertTags, setManualAlertTags] = useState([]);
  const [zeusConversations, setZeusConversations] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    localStorage.setItem("coletivo-fluxo:theme", theme);
  }, [theme]);

  // Depois do login: garante que o convite vira "ativo" e carrega todos os
  // dados compartilhados do time. Reseta se a sessão mudar (login/logout).
  useEffect(() => {
    if (!session) {
      setMyProfile(null);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await db.activateProfileIfPending(session.user.id);
        const profile = await db.fetchMyProfile(session.user.id);
        if (cancelled) return;
        setMyProfile(profile);
        if (!profile || profile.status !== "ativo") { setLoaded(true); return; }
        const [clientsData, entriesData, demandsData, teamData, notifsData, rulesData, fireLogData, themesData, postsData, postRecipientsData, postTagsData, manualAlertsData, manualAlertTagsData, zeusConversationsData, postReadsData, postRepliesData, postLikesData, dmConversationsData, themeGroupsData] = await Promise.all([
          db.fetchClients(), db.fetchEntries(), db.fetchDemands(), db.fetchTeam(),
          db.fetchNotifications(), db.fetchRules(), db.fetchRuleFireLog(),
          db.fetchThemes(), db.fetchPosts(), db.fetchPostRecipients(),
          db.fetchPostTags(), db.fetchAlerts(), db.fetchAlertTags(), db.fetchZeusConversations(),
          db.fetchPostReads(), db.fetchPostReplies(), db.fetchPostLikes(), db.fetchDmConversations(),
          db.fetchThemeGroups(),
        ]);
        if (cancelled) return;
        setClients(clientsData); setEntries(entriesData); setDemands(demandsData);
        setTeam(teamData); setNotifications(notifsData); setCommunicationRules(rulesData);
        setRuleFireLog(fireLogData); setThemes(themesData); setPosts(postsData); setPostRecipients(postRecipientsData);
        setPostTags(postTagsData); setManualAlerts(manualAlertsData); setManualAlertTags(manualAlertTagsData);
        setZeusConversations(zeusConversationsData);
        setPostReads(postReadsData); setPostReplies(postRepliesData);
        setPostLikes(postLikesData); setDmConversations(dmConversationsData);
        setThemeGroups(themeGroupsData);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  // Mantém os dados sincronizados entre todo mundo logado ao mesmo tempo.
  useEffect(() => {
    if (!loaded || !myProfile || myProfile.status !== "ativo") return;
    const subs = [
      ["fluxo_clients", setClients, db.fetchClients],
      ["fluxo_entries", setEntries, db.fetchEntries],
      ["fluxo_demands", setDemands, db.fetchDemands],
      ["fluxo_notifications", setNotifications, db.fetchNotifications],
      ["fluxo_profiles", setTeam, db.fetchTeam],
      ["fluxo_communication_rules", setCommunicationRules, db.fetchRules],
      ["fluxo_themes", setThemes, db.fetchThemes],
      ["fluxo_theme_groups", setThemeGroups, db.fetchThemeGroups],
      ["fluxo_posts", setPosts, db.fetchPosts],
      ["fluxo_post_recipients", setPostRecipients, db.fetchPostRecipients],
      ["fluxo_post_tags", setPostTags, db.fetchPostTags],
      ["fluxo_post_reads", setPostReads, db.fetchPostReads],
      ["fluxo_post_replies", setPostReplies, db.fetchPostReplies],
      ["fluxo_post_likes", setPostLikes, db.fetchPostLikes],
      ["fluxo_dm_conversations", setDmConversations, db.fetchDmConversations],
      ["fluxo_alerts", setManualAlerts, db.fetchAlerts],
      ["fluxo_alert_tags", setManualAlertTags, db.fetchAlertTags],
      ["fluxo_zeus_conversations", setZeusConversations, db.fetchZeusConversations],
    ].map(([table, setter, fetcher]) =>
      supabase
        .channel(`sync-${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          fetcher().then(setter).catch((e) => console.error(e));
        })
        .subscribe()
    );
    return () => subs.forEach((ch) => supabase.removeChannel(ch));
  }, [loaded, myProfile?.status]);

  const alertCount = useMemo(() => computeAlerts(clients, entries).length, [clients, entries]);
  const role = myProfile?.role === "admin" ? "admin" : "atendimento";
  const demandCount = (role === "admin" ? demands : demands.filter((d) => d.assigneeId === myProfile?.id)).filter((d) => d.status !== "concluida").length;

  // Padrão geral do raiozinho: qualquer item do menu com algo pendente de resolver.
  const pendingByTab = useMemo(() => {
    const p = {};
    if (role === "admin" && clients.length === 0) {
      p.clientes = "Cadastre seu primeiro cliente para começar a usar o Fluxo.";
    }
    if (role === "admin") {
      const pendingInvites = team.filter((t) => t.status === "convite pendente").length;
      if (pendingInvites > 0) {
        p.equipe = `${pendingInvites} convite${pendingInvites > 1 ? "s" : ""} pendente${pendingInvites > 1 ? "s" : ""} de aceite.`;
      }
    }
    return p;
  }, [role, clients.length, team]);

  const createDemandFromAlert = useCallback((d) => {
    setDemands((ds) => [...ds, d]);
    db.insertDemand(d).catch((e) => console.error(e));
  }, []);

  const manualNotify = useCallback((memberId, message, demandId) => {
    const notif = { id: uid(), memberId, message, demandId, read: false, createdAt: Date.now() };
    setNotifications((ns) => [...ns, notif]);
    db.insertNotification(notif).catch((e) => console.error(e));
  }, []);

  const createManualAlert = useCallback(async (alert, tagIds) => {
    setManualAlerts((as) => [...as, alert]);
    if (tagIds.length) setManualAlertTags((ts) => [...ts, ...tagIds.map((themeId) => ({ alertId: alert.id, themeId }))]);
    await db.insertAlert(alert, tagIds);
  }, []);

  // Motor de disparo dos Alertas manuais: dispara quando a data agendada
  // chega, cria post em Novidades + (se Relatório) um card de Demanda por
  // destinatário + notificação de sino. Alertas "Comunicação" recorrentes
  // voltam pra "agendado" com a próxima data, se repetindo sozinhos.
  useEffect(() => {
    if (!loaded || !myProfile || myProfile.status !== "ativo") return;
    const today = todayStr();
    const due = manualAlerts.filter((a) => a.status === "agendado" && a.scheduledDate <= today);
    if (due.length === 0) return;
    (async () => {
      for (const alert of due) {
        try {
          const recipientIds = resolveDestinoIds(alert.destino, team);
          if (recipientIds.length === 0) continue;
          const tagIds = manualAlertTags.filter((t) => t.alertId === alert.id).map((t) => t.themeId);
          const clientId = alert.clientIds.length === 1 ? alert.clientIds[0] : "";
          const everyone = !!alert.destino?.everyone;

          const post = {
            id: uid(), authorId: alert.createdBy, clientId, audience: everyone ? "todos" : "pessoas",
            message: `${alert.title}${alert.description ? " — " + alert.description : ""}`, createdAt: Date.now(),
          };
          await db.insertPost(post, everyone ? [] : recipientIds, tagIds);
          setPosts((ps) => [post, ...ps]);
          if (!everyone) setPostRecipients((rs) => [...rs, ...recipientIds.map((memberId) => ({ postId: post.id, memberId }))]);
          if (tagIds.length) setPostTags((ts) => [...ts, ...tagIds.map((themeId) => ({ postId: post.id, themeId }))]);

          const notifs = [];
          if (alert.alertType === "relatorio") {
            for (const memberId of recipientIds) {
              const demand = {
                id: uid(), title: alert.title, clientId, unitId: "", description: alert.description,
                priority: "normal", dueDate: alert.scheduledDate, status: "aberta", origin: "alerta_manual",
                type: "geral", assigneeId: memberId, recurring: { enabled: alert.repeatFreq !== "nenhuma", freq: alert.repeatFreq },
                briefing: "", attachments: [], requiresProof: true,
                proofQuestion: "Concluiu o que foi pedido nesse alerta?", proof: null, proofStatus: "pendente",
                actions: [], alertId: alert.id, createdAt: Date.now(),
              };
              await db.insertDemand(demand);
              setDemands((ds) => [...ds, demand]);
              notifs.push({ id: uid(), memberId, message: `Alerta: "${alert.title}"`, demandId: demand.id, read: false, createdAt: Date.now() });
            }
          } else {
            recipientIds.forEach((memberId) => {
              notifs.push({ id: uid(), memberId, message: `Alerta: "${alert.title}"`, demandId: null, read: false, createdAt: Date.now() });
            });
          }
          if (notifs.length) {
            await db.insertNotifications(notifs);
            setNotifications((ns) => [...ns, ...notifs]);
          }

          const updatedAlert =
            alert.alertType === "comunicacao" && alert.repeatFreq !== "nenhuma"
              ? { ...alert, scheduledDate: addAlertInterval(alert.scheduledDate, alert.repeatFreq), status: "agendado" }
              : { ...alert, status: "enviado" };
          await db.updateAlert(updatedAlert);
          setManualAlerts((as) => as.map((a) => (a.id === alert.id ? updatedAlert : a)));
        } catch (e) {
          console.error(e);
        }
      }
    })();
  }, [loaded, myProfile?.status, manualAlerts, team]); // eslint-disable-line

  // Réguas com action="alerta" criam um Alerta manual de verdade (que passa
  // pelo motor de disparo acima) em vez de só uma notificação simples.
  const dispatchRuleAlerts = useCallback((alertsToCreate) => {
    alertsToCreate.forEach(({ tagIds, ...alertRow }) => {
      createManualAlert(alertRow, tagIds).catch((e) => console.error(e));
    });
  }, [createManualAlert]);

  // time-based réguas: check once per load / whenever demands or rules change
  useEffect(() => {
    if (!loaded || !myProfile || myProfile.status !== "ativo") return;
    const { notifs, newKeys, alertsToCreate } = evaluateTimeRules(communicationRules, clients, demands, ruleFireLog, myProfile.id);
    if (notifs.length) {
      setNotifications((ns) => [...ns, ...notifs]);
      db.insertNotifications(notifs).catch((e) => console.error(e));
    }
    if (newKeys.length) {
      setRuleFireLog((fl) => [...fl, ...newKeys]);
      db.insertFireKeys(newKeys).catch((e) => console.error(e));
    }
    if (alertsToCreate.length) dispatchRuleAlerts(alertsToCreate);
    // eslint-disable-next-line
  }, [loaded, myProfile?.status, demands.length, communicationRules.length]);

  // alerta_disparado réguas: fire once per unique alert key
  const alerts = useMemo(() => computeAlerts(clients, entries), [clients, entries]);
  useEffect(() => {
    if (!loaded || !myProfile || myProfile.status !== "ativo") return;
    const activeAlertRules = communicationRules.filter((r) => r.active && r.trigger === "alerta_disparado");
    if (activeAlertRules.length === 0 || alerts.length === 0) return;
    const newNotifs = [];
    const newKeys = [];
    const alertsToCreate = [];
    alerts.forEach((a) => {
      const fireKey = `alerta:${a.id}`;
      if (ruleFireLog.includes(fireKey)) return;
      activeAlertRules.forEach((rule) => {
        if (!rule.recipientId) return;
        const message = `${rule.message} (${a.clientName} · ${a.unitName} — ${a.metricLabel})`;
        if (rule.action === "alerta") alertsToCreate.push(alertFromRule({ ...rule, _recipient: rule.recipientId }, message, null, myProfile.id));
        else newNotifs.push({ id: uid(), memberId: rule.recipientId, message, demandId: null, read: false, createdAt: Date.now() });
      });
      newKeys.push(fireKey);
    });
    if (newNotifs.length) {
      setNotifications((ns) => [...ns, ...newNotifs]);
      db.insertNotifications(newNotifs).catch((e) => console.error(e));
    }
    if (newKeys.length) {
      setRuleFireLog((fl) => [...fl, ...newKeys]);
      db.insertFireKeys(newKeys).catch((e) => console.error(e));
    }
    if (alertsToCreate.length) dispatchRuleAlerts(alertsToCreate);
    // eslint-disable-next-line
  }, [loaded, myProfile?.status, alerts.length, communicationRules.length]);

  useEffect(() => {
    const allowed = (role === "admin" ? NAV_ADMIN : NAV_STAFF).map((n) => n.id);
    if (!allowed.includes(tab)) setTab(allowed[0]);
  }, [role]); // eslint-disable-line

  if (sessionLoading) return null;

  if (authEvent === "PASSWORD_RECOVERY") {
    return <SetPassword theme={theme} onDone={() => window.location.assign(window.location.pathname)} />;
  }
  if (!session) return <Login theme={theme} />;
  if (!loaded) return null;
  if (!myProfile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
        Sua conta não tem um acesso configurado no Fluxo. Peça para o admin te convidar pela aba Equipe.
        <button onClick={() => supabase.auth.signOut()} style={{ marginLeft: 10 }}>Sair</button>
      </div>
    );
  }
  if (myProfile.status !== "ativo") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
        Seu acesso está desativado. Fale com o admin da conta.
        <button onClick={() => supabase.auth.signOut()} style={{ marginLeft: 10 }}>Sair</button>
      </div>
    );
  }

  const rootVars = {};
  VAR_KEYS.forEach((k) => (rootVars[`--c-${k}`] = THEMES[theme][k]));

  return (
    <div style={{ ...rootVars, display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "Inter, sans-serif" }}>
      <style>{FONT_IMPORT}</style>
      <Sidebar tab={tab} setTab={setTab} alertCount={alertCount} demandCount={demandCount} role={role} pendingByTab={pendingByTab} />
      <div style={{ flex: 1, padding: "22px 32px", overflowX: "hidden" }}>
        <TopBar theme={theme} setTheme={setTheme} me={myProfile} notifications={notifications} setNotifications={setNotifications} />
        {tab === "threads" && (
          <ThreadsView
            posts={posts} setPosts={setPosts}
            postRecipients={postRecipients} setPostRecipients={setPostRecipients}
            postTags={postTags} setPostTags={setPostTags}
            postReads={postReads} setPostReads={setPostReads}
            postReplies={postReplies} setPostReplies={setPostReplies}
            postLikes={postLikes} setPostLikes={setPostLikes}
            dmConversations={dmConversations} setDmConversations={setDmConversations}
            themes={themes} setThemes={setThemes} themeGroups={themeGroups} setThemeGroups={setThemeGroups}
            clients={clients} team={team} me={myProfile} role={role}
          />
        )}
        {tab === "clientes" && role === "admin" && <ClientsView clients={clients} setClients={setClients} team={team} themes={themes} setThemes={setThemes} themeGroups={themeGroups} />}
        {tab === "dashboard" && role === "admin" && (
          <ZeusView conversations={zeusConversations} setConversations={setZeusConversations} clients={clients} me={myProfile} />
        )}
        {tab === "alertas" && role === "admin" && (
          <AlertsView
            clients={clients} entries={entries} demands={demands} onCreateDemand={createDemandFromAlert}
            manualAlerts={manualAlerts} manualAlertTags={manualAlertTags} themes={themes} setThemes={setThemes}
            themeGroups={themeGroups} setThemeGroups={setThemeGroups}
            team={team} me={myProfile} onCreateAlert={createManualAlert}
          />
        )}
        {tab === "demandas" && <DemandsView clients={clients} demands={demands} setDemands={setDemands} team={team} notifications={notifications} setNotifications={setNotifications} currentUserId={myProfile.id} role={role} rules={communicationRules} themes={themes} themeGroups={themeGroups} manualAlertTags={manualAlertTags} onCreateAlert={createManualAlert} />}
        {tab === "lembretes" && <RemindersView clients={clients} />}
        {tab === "relatorios" && role === "admin" && <ReportsView clients={clients} entries={entries} demands={demands} />}
        {tab === "reguas" && role === "admin" && <RulesView team={team} rules={communicationRules} setRules={setCommunicationRules} themes={themes} setThemes={setThemes} themeGroups={themeGroups} setThemeGroups={setThemeGroups} />}
        {tab === "equipe" && role === "admin" && <TeamView team={team} setTeam={setTeam} demands={demands} clients={clients} onNotify={manualNotify} />}
      </div>
      {!myProfile.onboardedAt && (
        <Onboarding
          role={role}
          onFinish={() => {
            setMyProfile((p) => ({ ...p, onboardedAt: new Date().toISOString() }));
            db.markOnboarded(myProfile.id).catch((e) => console.error(e));
          }}
        />
      )}
    </div>
  );
}
