import React, { useState, useMemo, useRef } from "react";
import * as db from "./data.js";
import { C, Ticket, Btn, Field, inputStyle } from "./ui.jsx";

const uid = () => Math.random().toString(36).slice(2, 10);

export const TONES = { muted: C.mutedDim, amber: C.amber, teal: C.teal, red: C.red, brand: C.brand };
export const TONE_BG = { muted: C.surface3, amber: C.amberDim, teal: C.tealDim, red: C.redDim, brand: C.brandDim };
export const TONE_LABELS = { muted: "Cinza", amber: "Âmbar", teal: "Verde-azulado", red: "Vermelho", brand: "Azul" };

export const ROLE_LABEL = { atendimento: "Todo atendimento", admin: "Todo admin" };

/** Cor de um assunto vem do tema (grupo) dele, não mais de campo próprio. Compartilhado com alerts.jsx. */
export function resolveTone(theme, themeGroups) {
  return themeGroups?.find((g) => g.id === theme?.groupId)?.tone || theme?.tone || "muted";
}

/** Resolve o campo `destino` (combinável) pra uma lista final de member ids ativos. Compartilhado com alerts.jsx. */
export function resolveDestinoIds(destino, team) {
  const active = team.filter((t) => t.status === "ativo");
  if (destino?.everyone) return active.map((t) => t.id);
  const set = new Set(destino?.memberIds || []);
  (destino?.roles || []).forEach((role) => {
    active.filter((t) => t.role === role).forEach((t) => set.add(t.id));
  });
  return [...set];
}

export function timeAgo(ts) {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "agora";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `há ${diffD}d`;
  return new Date(ts).toLocaleDateString("pt-BR");
}

export const Avatar = ({ name, size = 32 }) => (
  <div
    style={{
      width: size, height: size, borderRadius: 999, background: C.brandDim, color: C.brand,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: size * 0.42,
    }}
  >
    {(name || "?").slice(0, 1).toUpperCase()}
  </div>
);

export const Tag = ({ children, tone = "muted" }) => (
  <span
    style={{
      background: TONE_BG[tone], color: TONES[tone], fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
      padding: "3px 8px", borderRadius: 999, fontFamily: "Inter, sans-serif", whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);

/* ---------------------------------------------------------------------- */
/* GERENCIAR TEMAS E ASSUNTOS (admin) — compartilhado entre Threads e Alertas */
/* ---------------------------------------------------------------------- */
export function ThemeManager({ themeGroups, setThemeGroups, themes, setThemes, onClose }) {
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupTone, setNewGroupTone] = useState("brand");
  const [newSubjectName, setNewSubjectName] = useState("");

  const addGroup = () => {
    if (!newGroupName.trim()) return;
    const group = { id: uid(), name: newGroupName.trim(), tone: newGroupTone };
    setThemeGroups((gs) => [...gs, group]);
    db.insertThemeGroup(group).catch((e) => console.error(e));
    setNewGroupName("");
  };

  const removeGroup = (id) => {
    setThemeGroups((gs) => gs.filter((g) => g.id !== id));
    db.deleteThemeGroup(id).catch((e) => console.error(e));
  };

  const addSubject = (groupId) => {
    if (!newSubjectName.trim()) return;
    const groupTone = themeGroups.find((g) => g.id === groupId)?.tone || "brand";
    const theme = { id: uid(), name: newSubjectName.trim(), tone: groupTone, groupId, clientId: "" };
    setThemes((ts) => [...ts, theme]);
    db.insertTheme(theme).catch((e) => console.error(e));
    setNewSubjectName("");
  };

  const removeSubject = (id) => {
    setThemes((ts) => ts.filter((t) => t.id !== id));
    db.deleteTheme(id).catch((e) => console.error(e));
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,9,13,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 60, overflowY: "auto" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 14, width: "100%", maxWidth: 460, padding: 24 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: C.text, textTransform: "uppercase", marginBottom: 16 }}>Gerenciar temas</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Novo tema" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGroup()} />
          <select style={{ ...inputStyle, width: 110 }} value={newGroupTone} onChange={(e) => setNewGroupTone(e.target.value)}>
            {Object.keys(TONES).map((t) => <option key={t} value={t}>{TONE_LABELS[t]}</option>)}
          </select>
          <Btn onClick={addGroup}>+</Btn>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {themeGroups.map((g) => {
            const isCliente = g.id === "grp-cliente";
            const isOpen = expandedGroup === g.id;
            const subjects = themes.filter((t) => t.groupId === g.id);
            return (
              <div key={g.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <div onClick={() => setExpandedGroup(isOpen ? null : g.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, cursor: "pointer" }}>
                  <Tag tone={g.tone}>{g.name}</Tag>
                  <span style={{ fontSize: 11, color: C.mutedDim }}>{subjects.length} assunto{subjects.length !== 1 ? "s" : ""}</span>
                  {!isCliente && (
                    <button onClick={(e) => { e.stopPropagation(); removeGroup(g.id); }} style={{ marginLeft: "auto", background: "none", border: "none", color: C.mutedDim, cursor: "pointer", fontSize: 11.5 }}>
                      remover tema
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div style={{ padding: "0 10px 10px", borderTop: `1px solid ${C.border}` }}>
                    {isCliente ? (
                      <div style={{ fontSize: 11.5, color: C.mutedDim, margin: "10px 0" }}>Sincronizado automaticamente com a aba Clientes.</div>
                    ) : (
                      <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
                        <input style={{ ...inputStyle, flex: 1 }} placeholder="Novo assunto" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubject(g.id)} />
                        <Btn onClick={() => addSubject(g.id)}>+</Btn>
                      </div>
                    )}
                    <div style={{ display: "grid", gap: 5 }}>
                      {subjects.map((t) => (
                        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12.5, color: C.text }}>{t.name}</span>
                          {!isCliente && (
                            <button onClick={() => removeSubject(t.id)} style={{ marginLeft: "auto", background: "none", border: "none", color: C.mutedDim, cursor: "pointer", fontSize: 11.5 }}>remover</button>
                          )}
                        </div>
                      ))}
                      {subjects.length === 0 && <div style={{ fontSize: 11.5, color: C.mutedDim }}>Nenhum assunto ainda.</div>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {themeGroups.length === 0 && <div style={{ fontSize: 12, color: C.mutedDim }}>Nenhum tema criado ainda.</div>}
        </div>
        <Btn variant="ghost" style={{ marginTop: 18, width: "100%", justifyContent: "center" }} onClick={onClose}>Fechar</Btn>
      </div>
    </div>
  );
}

/** Seletor de assuntos multi-select (chips agrupados por tema), compartilhado entre Threads e Alertas. */
export function TagPicker({ themes, themeGroups, selectedIds, onToggle }) {
  const groupsWithSubjects = themeGroups.filter((g) => themes.some((t) => t.groupId === g.id));
  if (groupsWithSubjects.length === 0) {
    return <span style={{ fontSize: 11.5, color: C.mutedDim }}>Nenhum assunto cadastrado ainda.</span>;
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {groupsWithSubjects.map((g) => (
        <div key={g.id}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: TONES[g.tone], marginBottom: 4 }}>{g.name}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {themes.filter((t) => t.groupId === g.id).map((t) => {
              const active = selectedIds.includes(t.id);
              return (
                <label
                  key={t.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer",
                    background: active ? TONE_BG[g.tone] : C.surface2, color: active ? TONES[g.tone] : C.muted,
                    border: `1px solid ${active ? TONES[g.tone] : C.border}`, borderRadius: 999, padding: "4px 10px", fontWeight: active ? 700 : 500,
                  }}
                >
                  <input type="checkbox" checked={active} onChange={() => onToggle(t.id)} style={{ margin: 0 }} />
                  {t.name}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* TEXTAREA COM AUTOCOMPLETE DE @MENÇÃO                                    */
/* ---------------------------------------------------------------------- */
export function MentionTextarea({ value, onChange, team, placeholder, style, onFocus }) {
  const [query, setQuery] = useState(null);
  const ref = useRef(null);

  const detectMention = (val, pos) => {
    const uptoCursor = val.slice(0, pos);
    const match = uptoCursor.match(/@([^\s@]*)$/);
    setQuery(match ? match[1] : null);
  };

  const handleChange = (e) => {
    onChange(e.target.value);
    detectMention(e.target.value, e.target.selectionStart);
  };

  const pickMention = (name) => {
    const el = ref.current;
    const pos = el.selectionStart;
    const uptoCursor = value.slice(0, pos);
    const match = uptoCursor.match(/@([^\s@]*)$/);
    if (!match) return;
    const start = pos - match[0].length;
    const newVal = value.slice(0, start) + "@" + name + " " + value.slice(pos);
    onChange(newVal);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const newPos = start + name.length + 2;
      el.setSelectionRange(newPos, newPos);
    });
  };

  const matches = query === null ? [] : team.filter((t) => t.status === "ativo" && t.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

  return (
    <div style={{ position: "relative", flex: 1 }}>
      <textarea
        ref={ref}
        style={style}
        placeholder={placeholder}
        value={value}
        onFocus={onFocus}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
      />
      {query !== null && matches.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 20, background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 8, marginTop: 4, minWidth: 170, boxShadow: "0 6px 18px rgba(0,0,0,.18)", overflow: "hidden" }}>
          {matches.map((t) => (
            <div
              key={t.id}
              onMouseDown={() => pickMention(t.name)}
              style={{ padding: "8px 12px", fontSize: 12.5, color: C.text, cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {t.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const chipStyle = (active) => ({
  display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer",
  background: active ? C.brandDim : C.surface2, color: active ? C.brand : C.muted,
  border: `1px solid ${active ? C.brand : C.border}`, borderRadius: 999, padding: "4px 10px", fontWeight: active ? 700 : 500,
});

/** Chips combináveis de destino (Todos / grupos de função / pessoas), compartilhado com alerts.jsx. */
export function DestinoChips({ everyone, setEveryone, roles, setRoles, memberIds, setMemberIds, team, excludeId }) {
  const toggle = (setter, arr, id) => setter(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        <label style={chipStyle(everyone)}>
          <input type="checkbox" checked={everyone} onChange={() => setEveryone((v) => !v)} style={{ margin: 0 }} /> Todos
        </label>
        {["atendimento", "admin"].map((r) => (
          <label key={r} style={chipStyle(roles.includes(r))}>
            <input type="checkbox" checked={roles.includes(r)} onChange={() => toggle(setRoles, roles, r)} style={{ margin: 0 }} /> {ROLE_LABEL[r]}
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {team.filter((t) => t.status === "ativo" && t.id !== excludeId).map((t) => (
          <label key={t.id} style={chipStyle(memberIds.includes(t.id))}>
            <input type="checkbox" checked={memberIds.includes(t.id)} onChange={() => toggle(setMemberIds, memberIds, t.id)} style={{ margin: 0 }} /> {t.name}
          </label>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* COMPOSER                                                                 */
/* ---------------------------------------------------------------------- */
function Composer({ themes, themeGroups, clients, team, me, role, onPost, onManageThemes }) {
  const [message, setMessage] = useState("");
  const [tagIds, setTagIds] = useState([]);
  const [clientId, setClientId] = useState("");
  const [everyone, setEveryone] = useState(true);
  const [roles, setRoles] = useState([]);
  const [memberIds, setMemberIds] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleTag = (id) => setTagIds((ts) => (ts.includes(id) ? ts.filter((t) => t !== id) : [...ts, id]));
  const hasDestino = everyone || roles.length > 0 || memberIds.length > 0;

  const publish = async () => {
    if (!message.trim() || !hasDestino) return;
    setBusy(true);
    const audience = everyone ? "todos" : "pessoas";
    const recipientIds = everyone ? [] : resolveDestinoIds({ everyone: false, roles, memberIds }, team);
    const post = { id: uid(), authorId: me.id, clientId, audience, message: message.trim(), createdAt: Date.now() };
    try {
      await onPost(post, recipientIds, tagIds);
      setMessage(""); setTagIds([]); setClientId(""); setEveryone(true); setRoles([]); setMemberIds([]); setExpanded(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Ticket style={{ padding: 16, marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <Avatar name={me?.name} />
        <MentionTextarea
          style={{ ...inputStyle, flex: 1, minHeight: expanded ? 70 : 38, resize: "vertical", transition: "min-height .12s" }}
          placeholder="Compartilhe uma novidade com o time... (use @ pra marcar alguém)"
          value={message}
          team={team}
          onFocus={() => setExpanded(true)}
          onChange={setMessage}
        />
      </div>
      {expanded && (
        <div style={{ marginTop: 12, paddingLeft: 42 }}>
          <div style={{ marginBottom: 10 }}>
            <TagPicker themes={themes} themeGroups={themeGroups} selectedIds={tagIds} onToggle={toggleTag} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <select style={{ ...inputStyle, width: "auto", flex: "1 1 140px" }} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— sem cliente —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {role === "admin" && (
              <button onClick={onManageThemes} style={{ background: "none", border: "none", color: C.brand, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                Gerenciar temas
              </button>
            )}
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.mutedDim, marginBottom: 6, fontWeight: 600 }}>{everyone ? "Público" : "Privado — quem participa"}</div>
            <DestinoChips everyone={everyone} setEveryone={setEveryone} roles={roles} setRoles={setRoles} memberIds={memberIds} setMemberIds={setMemberIds} team={team} excludeId={me.id} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn variant="ghost" onClick={() => { setExpanded(false); setMessage(""); }}>Cancelar</Btn>
            <Btn disabled={busy || !message.trim() || !hasDestino} onClick={publish}>
              {busy ? "Publicando..." : "Publicar"}
            </Btn>
          </div>
        </div>
      )}
    </Ticket>
  );
}

/** Tag clicável — funciona como botão de filtro quando `onClick` é passado. */
function ClickableTag({ tone, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: TONE_BG[tone], color: TONES[tone], fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
        padding: "3px 8px", borderRadius: 999, fontFamily: "Inter, sans-serif", whiteSpace: "nowrap",
        border: "none", cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/** Renderiza @menções em negrito quando batem com um nome real da equipe. */
function renderMessage(message, team) {
  const names = team.map((t) => t.name).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!names.length) return message;
  const pattern = new RegExp(`@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  const parts = message.split(pattern);
  return parts.map((part, i) => (names.includes(part) ? <b key={i} style={{ color: C.brand }}>@{part}</b> : part));
}

/* ---------------------------------------------------------------------- */
/* CONFIRMAÇÃO DE LEITURA (estilo WhatsApp) + RESPOSTAS                   */
/* ---------------------------------------------------------------------- */
function ReadReceipts({ reads, team, me, onMarkRead }) {
  const [open, setOpen] = useState(false);
  const iRead = reads.some((r) => r.memberId === me.id);
  const others = reads.filter((r) => r.memberId !== me.id);

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
      {!iRead && (
        <button onClick={onMarkRead} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 999, padding: "3px 10px", fontSize: 11, color: C.muted, cursor: "pointer", fontWeight: 600 }}>
          ✓ Marcar como visto
        </button>
      )}
      {reads.length > 0 && (
        <button onClick={() => setOpen((v) => !v)} style={{ background: "none", border: "none", color: iRead ? C.brand : C.mutedDim, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
          {iRead ? "✓✓" : "✓"} Visto por {reads.length}
        </button>
      )}
      {open && (
        <div style={{ position: "absolute", bottom: "100%", left: 0, zIndex: 15, background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 8, marginBottom: 6, padding: 10, minWidth: 190, boxShadow: "0 6px 18px rgba(0,0,0,.18)" }}>
          {[...(iRead ? [{ memberId: me.id, readAt: reads.find((r) => r.memberId === me.id)?.readAt }] : []), ...others].map((r) => (
            <div key={r.memberId} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11.5, color: C.text, padding: "3px 0" }}>
              <span>{r.memberId === me.id ? "Você" : team.find((t) => t.id === r.memberId)?.name || "—"}</span>
              <span style={{ color: C.mutedDim }}>{timeAgo(r.readAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RepliesThread({ replies, team, me, onReply }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onReply(text.trim());
      setText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} style={{ background: "none", border: "none", color: C.mutedDim, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
        💬 {replies.length > 0 ? `${replies.length} resposta${replies.length !== 1 ? "s" : ""}` : "Responder"}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {replies.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 8 }}>
              <Avatar name={team.find((t) => t.id === r.authorId)?.name} size={22} />
              <div style={{ flex: 1, background: C.surface2, borderRadius: 8, padding: "6px 10px" }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text }}>
                  {team.find((t) => t.id === r.authorId)?.name || "Alguém"} <span style={{ fontWeight: 400, color: C.mutedDim }}>· {timeAgo(r.createdAt)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: C.text, whiteSpace: "pre-wrap" }}>{renderMessage(r.message, team)}</div>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <MentionTextarea
              style={{ ...inputStyle, flex: 1, minHeight: 32, fontSize: 12.5, padding: "6px 10px" }}
              placeholder="Escreva uma resposta..."
              value={text}
              team={team}
              onChange={setText}
            />
            <Btn disabled={busy || !text.trim()} onClick={send}>Enviar</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/** Coração de curtida, clicável, com contador. */
function LikeButton({ liked, count, onClick }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", color: liked ? C.red : C.mutedDim, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: 13 }}>{liked ? "♥" : "♡"}</span> {count > 0 ? count : "Curtir"}
    </button>
  );
}

/* ---------------------------------------------------------------------- */
/* POST CARD                                                               */
/* ---------------------------------------------------------------------- */
function PostCard({ post, author, tags, themeGroups, client, recipients, team, me, role, onDelete, onFilterTag, reads, replies, onMarkRead, onReply, liked, likeCount, onToggleLike, unread }) {
  const canDelete = post.authorId === me.id || role === "admin";
  return (
    <Ticket style={{ padding: 16, marginBottom: 10, animation: "fluxo-fade-in .25s ease", position: "relative" }}>
      {unread && (
        <span title="Não lido" style={{ position: "absolute", top: 14, right: 14, width: 8, height: 8, borderRadius: 999, background: C.brand }} />
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <Avatar name={author?.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{author?.name || "Alguém"}</span>
            <span style={{ fontSize: 11.5, color: C.mutedDim }}>{timeAgo(post.createdAt)}</span>
            {canDelete && (
              <button onClick={() => onDelete(post.id)} style={{ marginLeft: "auto", background: "none", border: "none", color: C.mutedDim, cursor: "pointer" }} title="Apagar post">
                ×
              </button>
            )}
          </div>
          <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.5, marginTop: 6, whiteSpace: "pre-wrap" }}>{renderMessage(post.message, team)}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {tags.map((t) => <ClickableTag key={t.id} tone={resolveTone(t, themeGroups)} onClick={() => onFilterTag(t.id)}>{t.name}</ClickableTag>)}
            {client && <Tag tone="muted">{client.name}</Tag>}
            {post.audience === "pessoas" && (
              <Tag tone="brand">Para: {recipients.map((id) => team.find((t) => t.id === id)?.name).filter(Boolean).join(", ") || "—"}</Tag>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <LikeButton liked={liked} count={likeCount} onClick={onToggleLike} />
              <RepliesThread replies={replies} team={team} me={me} onReply={onReply} />
            </div>
            <ReadReceipts reads={reads} team={team} me={me} onMarkRead={onMarkRead} />
          </div>
        </div>
      </div>
    </Ticket>
  );
}

/* ---------------------------------------------------------------------- */
/* MENSAGEM DIRETA (DM) — barra lateral + painel de conversa               */
/* ---------------------------------------------------------------------- */
function NewDmPicker({ team, me, onPick, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,9,13,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 60 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 14, width: "100%", maxWidth: 320, padding: 18 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: C.text, textTransform: "uppercase", marginBottom: 12 }}>Nova conversa</div>
        <div style={{ display: "grid", gap: 4 }}>
          {team.filter((t) => t.status === "ativo" && t.id !== me.id).map((t) => (
            <button
              key={t.id}
              onClick={() => onPick(t.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", borderRadius: 8, padding: "8px 6px", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Avatar name={t.name} size={26} />
              <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{t.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DmSidebar({ conversations, team, me, activeId, onSelect, onNew }) {
  const [showPicker, setShowPicker] = useState(false);
  const otherOf = (c) => (c.memberAId === me.id ? c.memberBId : c.memberAId);

  return (
    <div style={{ width: 216, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: C.mutedDim }}>Mensagens</div>
        <button onClick={() => setShowPicker(true)} title="Nova conversa" style={{ background: "none", border: "none", color: C.brand, fontSize: 17, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}>+</button>
      </div>
      <button
        onClick={() => onSelect(null)}
        style={{ textAlign: "left", background: activeId === null ? C.surface3 : "transparent", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: C.text, fontSize: 12.5, fontWeight: activeId === null ? 700 : 500 }}
      >
        📣 Feed público
      </button>
      {conversations.map((c) => {
        const otherId = otherOf(c);
        const other = team.find((t) => t.id === otherId);
        const unread = c.messages?.some((m) => m.senderId !== me.id && !m.readAt);
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            style={{ textAlign: "left", background: activeId === c.id ? C.surface3 : "transparent", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            <Avatar name={other?.name} size={24} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.text, fontWeight: unread ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {other?.name || "—"}
            </span>
            {unread && <span style={{ width: 7, height: 7, borderRadius: 999, background: C.brand, flexShrink: 0 }} />}
          </button>
        );
      })}
      {showPicker && <NewDmPicker team={team} me={me} onClose={() => setShowPicker(false)} onPick={(id) => { setShowPicker(false); onNew(id); }} />}
    </div>
  );
}

function DmChatPanel({ conversation, messages, team, me, onSend }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const otherId = conversation.memberAId === me.id ? conversation.memberBId : conversation.memberAId;
  const other = team.find((t) => t.id === otherId);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSend(text.trim());
      setText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Ticket style={{ padding: 0, display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={other?.name} size={28} />
        <div style={{ fontWeight: 700, color: C.text, fontSize: 14.5 }}>{other?.name || "—"}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "grid", gap: 10 }}>
        {messages.length === 0 && <div style={{ color: C.mutedDim, fontSize: 13, textAlign: "center", marginTop: 30 }}>Nenhuma mensagem ainda. Diga oi.</div>}
        {messages.map((m) => {
          const mine = m.senderId === me.id;
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "70%", background: mine ? C.brand : C.surface2, color: mine ? "#fff" : C.text, borderRadius: 12, padding: "8px 12px", fontSize: 13.5, whiteSpace: "pre-wrap" }}>
                {renderMessage(m.message, team)}
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 3 }}>{timeAgo(m.createdAt)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: 14, borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
        <MentionTextarea
          style={{ ...inputStyle, flex: 1, minHeight: 38, resize: "none" }}
          placeholder="Escreva uma mensagem..."
          value={text}
          team={team}
          onChange={setText}
        />
        <Btn disabled={busy || !text.trim()} onClick={send}>Enviar</Btn>
      </div>
    </Ticket>
  );
}

/* ---------------------------------------------------------------------- */
/* THREADS VIEW                                                            */
/* ---------------------------------------------------------------------- */
export function ThreadsView({
  posts, setPosts, postRecipients, setPostRecipients, postTags, setPostTags,
  postReads, setPostReads, postReplies, setPostReplies, postLikes, setPostLikes,
  dmConversations, setDmConversations,
  themes, setThemes, themeGroups, setThemeGroups, clients, team, me, role,
}) {
  const [filterTag, setFilterTag] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterMode, setFilterMode] = useState("tudo"); // tudo | meu | postei
  const [viewMode, setViewMode] = useState("recentes"); // recentes | data | tag
  const [showThemeManager, setShowThemeManager] = useState(false);
  const [activeDmId, setActiveDmId] = useState(null);
  const [dmMessagesByConv, setDmMessagesByConv] = useState({});

  const recipientsByPost = useMemo(() => {
    const map = {};
    postRecipients.forEach((r) => {
      if (!map[r.postId]) map[r.postId] = [];
      map[r.postId].push(r.memberId);
    });
    return map;
  }, [postRecipients]);

  const tagsByPost = useMemo(() => {
    const map = {};
    postTags.forEach((r) => {
      if (!map[r.postId]) map[r.postId] = [];
      map[r.postId].push(r.themeId);
    });
    return map;
  }, [postTags]);

  const readsByPost = useMemo(() => {
    const map = {};
    postReads.forEach((r) => {
      if (!map[r.postId]) map[r.postId] = [];
      map[r.postId].push(r);
    });
    return map;
  }, [postReads]);

  const repliesByPost = useMemo(() => {
    const map = {};
    postReplies.forEach((r) => {
      if (!map[r.postId]) map[r.postId] = [];
      map[r.postId].push(r);
    });
    return map;
  }, [postReplies]);

  const likesByPost = useMemo(() => {
    const map = {};
    postLikes.forEach((r) => {
      if (!map[r.postId]) map[r.postId] = [];
      map[r.postId].push(r.memberId);
    });
    return map;
  }, [postLikes]);

  const unreadCount = useMemo(
    () => posts.filter((p) => p.authorId !== me.id && !(readsByPost[p.id] || []).some((r) => r.memberId === me.id)).length,
    [posts, readsByPost, me.id]
  );

  const visiblePosts = useMemo(() => {
    return posts
      .filter((p) => !filterTag || (tagsByPost[p.id] || []).includes(filterTag))
      .filter((p) => !filterClient || p.clientId === filterClient)
      .filter((p) => {
        if (filterMode === "postei") return p.authorId === me.id;
        if (filterMode === "meu") return p.authorId === me.id || (recipientsByPost[p.id] || []).includes(me.id);
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [posts, filterTag, filterClient, filterMode, recipientsByPost, tagsByPost, me.id]);

  const publish = async (post, recipientIds, tagIds) => {
    setPosts((ps) => [post, ...ps]);
    if (recipientIds.length) {
      setPostRecipients((rs) => [...rs, ...recipientIds.map((memberId) => ({ postId: post.id, memberId }))]);
    }
    if (tagIds.length) {
      setPostTags((ts) => [...ts, ...tagIds.map((themeId) => ({ postId: post.id, themeId }))]);
    }
    await db.insertPost(post, recipientIds, tagIds);
  };

  const remove = (id) => {
    setPosts((ps) => ps.filter((p) => p.id !== id));
    setPostRecipients((rs) => rs.filter((r) => r.postId !== id));
    setPostTags((ts) => ts.filter((t) => t.postId !== id));
    setPostReads((rs) => rs.filter((r) => r.postId !== id));
    setPostReplies((rs) => rs.filter((r) => r.postId !== id));
    db.deletePost(id).catch((e) => console.error(e));
  };

  const markRead = (postId) => {
    setPostReads((rs) => (rs.some((r) => r.postId === postId && r.memberId === me.id) ? rs : [...rs, { postId, memberId: me.id, readAt: Date.now() }]));
    db.markPostRead(postId, me.id).catch((e) => console.error(e));
  };

  const reply = async (postId, text) => {
    const r = { id: uid(), postId, authorId: me.id, message: text, createdAt: Date.now() };
    setPostReplies((rs) => [...rs, r]);
    await db.insertPostReply(r);
  };

  const toggleLike = (postId) => {
    const liked = (likesByPost[postId] || []).includes(me.id);
    setPostLikes((ls) =>
      liked ? ls.filter((l) => !(l.postId === postId && l.memberId === me.id)) : [...ls, { postId, memberId: me.id }]
    );
    db.togglePostLike(postId, me.id, !liked).catch((e) => console.error(e));
  };

  const openDm = async (conversationId) => {
    setActiveDmId(conversationId);
    if (conversationId && !dmMessagesByConv[conversationId]) {
      const msgs = await db.fetchDmMessages(conversationId);
      setDmMessagesByConv((m) => ({ ...m, [conversationId]: msgs }));
    }
    if (conversationId) {
      await db.markDmConversationRead(conversationId, me.id);
      setDmMessagesByConv((m) => ({
        ...m,
        [conversationId]: (m[conversationId] || []).map((msg) => (msg.senderId !== me.id && !msg.readAt ? { ...msg, readAt: Date.now() } : msg)),
      }));
    }
  };

  const startDm = async (otherId) => {
    const conv = await db.findOrCreateDmConversation(me.id, otherId);
    setDmConversations((cs) => (cs.some((c) => c.id === conv.id) ? cs : [conv, ...cs]));
    await openDm(conv.id);
  };

  const sendDm = async (text) => {
    if (!activeDmId) return;
    const msg = { id: uid(), conversationId: activeDmId, senderId: me.id, message: text, createdAt: Date.now(), readAt: null };
    setDmMessagesByConv((m) => ({ ...m, [activeDmId]: [...(m[activeDmId] || []), msg] }));
    await db.insertDmMessage(msg);
  };

  const activeConv = dmConversations.find((c) => c.id === activeDmId);

  const grouped = useMemo(() => {
    if (viewMode === "data") {
      const map = {};
      visiblePosts.forEach((p) => {
        const key = new Date(p.createdAt).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
        if (!map[key]) map[key] = [];
        map[key].push(p);
      });
      return Object.entries(map);
    }
    if (viewMode === "tag") {
      const map = {};
      visiblePosts.forEach((p) => {
        const ids = tagsByPost[p.id] || [];
        const key = ids.length ? ids[0] : "__sem_tag";
        if (!map[key]) map[key] = [];
        map[key].push(p);
      });
      return Object.entries(map).map(([key, list]) => [key === "__sem_tag" ? "Sem tag" : themes.find((t) => t.id === key)?.name || "Tag removida", list]);
    }
    return [["", visiblePosts]];
  }, [viewMode, visiblePosts, tagsByPost, themes]);

  const renderPost = (post) => (
    <PostCard
      key={post.id}
      post={post}
      author={team.find((t) => t.id === post.authorId)}
      tags={(tagsByPost[post.id] || []).map((tid) => themes.find((t) => t.id === tid)).filter(Boolean)}
      themeGroups={themeGroups}
      client={clients.find((c) => c.id === post.clientId)}
      recipients={recipientsByPost[post.id] || []}
      team={team}
      me={me}
      role={role}
      onDelete={remove}
      onFilterTag={(id) => { setFilterTag(id); setViewMode("recentes"); }}
      reads={readsByPost[post.id] || []}
      replies={repliesByPost[post.id] || []}
      onMarkRead={() => markRead(post.id)}
      onReply={(text) => reply(post.id, text)}
      liked={(likesByPost[post.id] || []).includes(me.id)}
      likeCount={(likesByPost[post.id] || []).length}
      onToggleLike={() => toggleLike(post.id)}
      unread={post.authorId !== me.id && !(readsByPost[post.id] || []).some((r) => r.memberId === me.id)}
    />
  );

  return (
    <div style={{ display: "flex", gap: 18 }}>
      <DmSidebar conversations={dmConversations} team={team} me={me} activeId={activeDmId} onSelect={openDm} onNew={startDm} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <style>{`@keyframes fluxo-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>

        {activeConv ? (
          <DmChatPanel
            conversation={activeConv}
            messages={dmMessagesByConv[activeConv.id] || []}
            team={team}
            me={me}
            onSend={sendDm}
          />
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 800, color: C.text, margin: 0, textTransform: "uppercase", letterSpacing: 0.3 }}>
                    Threads
                  </h1>
                  {unreadCount > 0 && (
                    <span style={{ background: C.tealDim, color: C.teal, fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>
                      ● {unreadCount} não lido{unreadCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 0" }}>Comunicação interna do time — públicas ou direto com alguém</p>
              </div>
              <select style={{ ...inputStyle, width: "auto" }} value={filterClient} onChange={(e) => setFilterClient(e.target.value)}>
                <option value="">Todos os clientes</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {[["recentes", "Mais Recentes"], ["data", "Por Data"], ["tag", "Por Tag"]].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setViewMode(id)}
                  style={{
                    background: viewMode === id ? C.brand : C.surface2, color: viewMode === id ? "#fff" : C.muted,
                    border: `1px solid ${viewMode === id ? C.brand : C.border}`, borderRadius: 999, padding: "6px 14px",
                    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif",
                  }}
                >
                  {label}
                </button>
              ))}
              <div style={{ width: 1, background: C.border, margin: "4px 2px" }} />
              {[["tudo", "Tudo"], ["meu", "Só pra mim"], ["postei", "Que eu postei"]].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFilterMode(id)}
                  style={{
                    background: filterMode === id ? C.surface3 : "transparent", color: filterMode === id ? C.text : C.mutedDim,
                    border: `1px solid ${C.border}`, borderRadius: 999, padding: "6px 14px",
                    fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {themes.length > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
                {themeGroups.filter((g) => themes.some((t) => t.groupId === g.id)).map((g) => (
                  <div key={g.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: TONES[g.tone], textTransform: "uppercase" }}>{g.name}:</span>
                    {themes.filter((t) => t.groupId === g.id).map((t) => (
                      <ClickableTag key={t.id} tone={g.tone} onClick={() => { setFilterTag(filterTag === t.id ? "" : t.id); setViewMode("recentes"); }}>
                        {filterTag === t.id ? "✓ " : ""}{t.name}
                      </ClickableTag>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <Composer themes={themes} themeGroups={themeGroups} clients={clients} team={team} me={me} role={role} onPost={publish} onManageThemes={() => setShowThemeManager(true)} />

            {visiblePosts.length === 0 && (
              <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: "40px 20px", textAlign: "center", color: C.mutedDim, fontSize: 13 }}>
                Nenhuma novidade por aqui ainda. Seja o primeiro a postar algo pro time.
              </div>
            )}
            {grouped.map(([label, list]) => (
              <div key={label || "all"}>
                {label && (
                  <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: C.mutedDim, margin: "18px 0 8px" }}>
                    {label}
                  </div>
                )}
                {list.map(renderPost)}
              </div>
            ))}

            {showThemeManager && <ThemeManager themeGroups={themeGroups} setThemeGroups={setThemeGroups} themes={themes} setThemes={setThemes} onClose={() => setShowThemeManager(false)} />}
          </>
        )}
      </div>
    </div>
  );
}
