import React, { useState, useMemo } from "react";
import * as db from "./data.js";
import { C, Ticket, Btn, Field, inputStyle } from "./ui.jsx";
import { Avatar, Tag, TagPicker, ThemeManager, timeAgo, ROLE_LABEL, resolveDestinoIds, DestinoChips, resolveTone } from "./threads.jsx";

const uid = () => Math.random().toString(36).slice(2, 10);

export { resolveDestinoIds };

function destinoSummary(destino, team) {
  if (destino?.everyone) return "Todos";
  const parts = [];
  (destino?.roles || []).forEach((r) => parts.push(ROLE_LABEL[r] || r));
  const ids = destino?.memberIds || [];
  if (ids.length) {
    const names = ids.map((id) => team.find((t) => t.id === id)?.name).filter(Boolean);
    parts.push(names.length <= 2 ? names.join(", ") : `${names.length} pessoas`);
  }
  return parts.length ? parts.join(" + ") : "Ninguém selecionado";
}

const STATUS_LABEL = { agendado: "Agendado", enviado: "Enviado" };
const STATUS_TONE = { agendado: "amber", enviado: "teal" };

/* ---------------------------------------------------------------------- */
/* FORMULÁRIO DE CRIAÇÃO                                                   */
/* ---------------------------------------------------------------------- */
function AlertForm({ themes, themeGroups, clients, team, me, onCreate, onManageTags }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [alertType, setAlertType] = useState("relatorio");
  const [clientIds, setClientIds] = useState([]);
  const [tagIds, setTagIds] = useState([]);
  const [everyone, setEveryone] = useState(false);
  const [roles, setRoles] = useState([]);
  const [memberIds, setMemberIds] = useState([]);
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [repeatFreq, setRepeatFreq] = useState("nenhuma");
  const [busy, setBusy] = useState(false);

  const toggle = (setter, arr, id) => setter(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const destino = { everyone, roles, memberIds };
  const hasDestino = everyone || roles.length > 0 || memberIds.length > 0;
  const canSave = title.trim() && hasDestino && scheduledDate;

  const reset = () => {
    setTitle(""); setDescription(""); setAlertType("relatorio"); setClientIds([]); setTagIds([]);
    setEveryone(false); setRoles([]); setMemberIds([]); setRepeatFreq("nenhuma");
    setScheduledDate(new Date().toISOString().slice(0, 10)); setExpanded(false);
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    const alert = {
      id: uid(), title: title.trim(), description: description.trim(), alertType,
      clientIds, destino, scheduledDate, repeatFreq, status: "agendado", createdBy: me.id, createdAt: Date.now(),
    };
    try {
      await onCreate(alert, tagIds);
      reset();
    } finally {
      setBusy(false);
    }
  };

  if (!expanded) {
    return (
      <Btn onClick={() => setExpanded(true)} style={{ marginBottom: 18 }}>+ Criar alerta</Btn>
    );
  }

  return (
    <Ticket style={{ padding: 18, marginBottom: 18 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: C.text, textTransform: "uppercase", marginBottom: 14 }}>
        Novo alerta
      </div>

      <Field label="Destino" hint="Combine quantos quiser: grupos de função, todos, e/ou pessoas específicas.">
        <DestinoChips everyone={everyone} setEveryone={setEveryone} roles={roles} setRoles={setRoles} memberIds={memberIds} setMemberIds={setMemberIds} team={team} />
      </Field>

      <Field label="Título">
        <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Atualizar Dash consolidado" />
      </Field>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Clientes" hint="Deixe em branco se não for sobre um cliente específico.">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {clients.map((c) => (
                <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer", background: clientIds.includes(c.id) ? C.surface3 : C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 999, padding: "4px 10px" }}>
                  <input type="checkbox" checked={clientIds.includes(c.id)} onChange={() => toggle(setClientIds, clientIds, c.id)} style={{ margin: 0 }} /> {c.name}
                </label>
              ))}
              {clients.length === 0 && <span style={{ fontSize: 11.5, color: C.mutedDim }}>Nenhum cliente cadastrado.</span>}
            </div>
          </Field>
        </div>
      </div>

      <Field label="Tema e assunto">
        <TagPicker themes={themes} themeGroups={themeGroups} selectedIds={tagIds} onToggle={(id) => toggle(setTagIds, tagIds, id)} />
        <button onClick={onManageTags} style={{ background: "none", border: "none", color: C.brand, fontSize: 11.5, fontWeight: 600, cursor: "pointer", marginTop: 6, padding: 0 }}>
          Gerenciar temas
        </button>
      </Field>

      <Field label="Tipo">
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: C.text, cursor: "pointer", flex: 1, background: alertType === "relatorio" ? C.surface2 : "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
            <input type="radio" checked={alertType === "relatorio"} onChange={() => setAlertType("relatorio")} style={{ marginTop: 2 }} />
            <span><b>Relatório</b> — avisa no sino, em Novidades, e vira um card em Demandas com comprovação obrigatória.</span>
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: C.text, cursor: "pointer", flex: 1, background: alertType === "comunicacao" ? C.surface2 : "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
            <input type="radio" checked={alertType === "comunicacao"} onChange={() => setAlertType("comunicacao")} style={{ marginTop: 2 }} />
            <span><b>Comunicação</b> — só aparece em Novidades, sem card e sem exigir ação.</span>
          </label>
        </div>
      </Field>

      <Field label="Descrição">
        <textarea style={{ ...inputStyle, minHeight: 70 }} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Data para envio">
            <input type="date" style={inputStyle} value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Repetir">
            <select style={inputStyle} value={repeatFreq} onChange={(e) => setRepeatFreq(e.target.value)}>
              <option value="nenhuma">Não repetir</option>
              <option value="diaria">Diariamente</option>
              <option value="semanal">Semanalmente</option>
              <option value="mensal">Mensalmente</option>
            </select>
          </Field>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <Btn variant="ghost" onClick={reset}>Cancelar</Btn>
        <Btn disabled={busy || !canSave} onClick={save}>{busy ? "Enviando..." : "Salvar e enviar"}</Btn>
      </div>
    </Ticket>
  );
}

/* ---------------------------------------------------------------------- */
/* PAINEL DE STATUS                                                        */
/* ---------------------------------------------------------------------- */
function StatTile({ label, value, tone = "muted" }) {
  return (
    <Ticket style={{ padding: "14px 18px", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: C[tone] || C.text, fontFamily: "'Barlow Condensed', sans-serif" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{label}</div>
    </Ticket>
  );
}

/* ---------------------------------------------------------------------- */
/* LISTA DE ALERTAS CRIADOS                                                */
/* ---------------------------------------------------------------------- */
function AlertRow({ alert, tags, themeGroups, team, creator, pending, done }) {
  return (
    <Ticket style={{ padding: 14, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Avatar name={creator?.name} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{alert.title}</span>
            <Tag tone={STATUS_TONE[alert.status]}>{STATUS_LABEL[alert.status]}</Tag>
            <Tag tone={alert.alertType === "relatorio" ? "brand" : "muted"}>{alert.alertType === "relatorio" ? "Relatório" : "Comunicação"}</Tag>
            {tags.map((t) => <Tag key={t.id} tone={resolveTone(t, themeGroups)}>{t.name}</Tag>)}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
            Para: {destinoSummary(alert.destino, team)} · Criado por {creator?.name || "—"} · {timeAgo(alert.createdAt)}
            {alert.repeatFreq !== "nenhuma" && ` · repete ${alert.repeatFreq}`}
          </div>
          {alert.alertType === "relatorio" && alert.status === "enviado" && (
            <div style={{ fontSize: 11.5, color: C.mutedDim, marginTop: 4 }}>
              {done} de {pending + done} concluído{pending + done !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>
    </Ticket>
  );
}

/* ---------------------------------------------------------------------- */
/* SEÇÃO COMPLETA — usada dentro de AlertsView (App.jsx)                   */
/* ---------------------------------------------------------------------- */
export function ManualAlertsSection({ alerts, alertTags, themes, setThemes, themeGroups, setThemeGroups, clients, team, me, demands, onCreateAlert }) {
  const [showThemeManager, setShowThemeManager] = useState(false);

  const tagsByAlert = useMemo(() => {
    const map = {};
    alertTags.forEach((r) => {
      if (!map[r.alertId]) map[r.alertId] = [];
      map[r.alertId].push(r.themeId);
    });
    return map;
  }, [alertTags]);

  const demandsByAlert = useMemo(() => {
    const map = {};
    demands.forEach((d) => {
      if (!d.alertId) return;
      if (!map[d.alertId]) map[d.alertId] = [];
      map[d.alertId].push(d);
    });
    return map;
  }, [demands]);

  const stats = useMemo(() => {
    const agendados = alerts.filter((a) => a.status === "agendado").length;
    const enviados = alerts.filter((a) => a.status === "enviado").length;
    const linkedDemands = demands.filter((d) => d.alertId);
    const pendentes = linkedDemands.filter((d) => d.status !== "concluida").length;
    const concluidos = linkedDemands.filter((d) => d.status === "concluida").length;
    return { agendados, enviados, pendentes, concluidos };
  }, [alerts, demands]);

  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: C.text, textTransform: "uppercase", marginBottom: 12 }}>
        Alertas pra equipe
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatTile label="Agendados" value={stats.agendados} tone="amber" />
        <StatTile label="Enviados" value={stats.enviados} tone="brand" />
        <StatTile label="Pendentes de execução" value={stats.pendentes} tone="red" />
        <StatTile label="Concluídos" value={stats.concluidos} tone="teal" />
      </div>

      <AlertForm themes={themes} themeGroups={themeGroups} clients={clients} team={team} me={me} onCreate={onCreateAlert} onManageTags={() => setShowThemeManager(true)} />

      {alerts.length === 0 && (
        <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: "24px 20px", textAlign: "center", color: C.mutedDim, fontSize: 13 }}>
          Nenhum alerta criado ainda.
        </div>
      )}
      {alerts.map((alert) => {
        const linked = demandsByAlert[alert.id] || [];
        return (
          <AlertRow
            key={alert.id}
            alert={alert}
            tags={(tagsByAlert[alert.id] || []).map((tid) => themes.find((t) => t.id === tid)).filter(Boolean)}
            themeGroups={themeGroups}
            team={team}
            creator={team.find((t) => t.id === alert.createdBy)}
            pending={linked.filter((d) => d.status !== "concluida").length}
            done={linked.filter((d) => d.status === "concluida").length}
          />
        );
      })}

      {showThemeManager && <ThemeManager themeGroups={themeGroups} setThemeGroups={setThemeGroups} themes={themes} setThemes={setThemes} onClose={() => setShowThemeManager(false)} />}
    </div>
  );
}
