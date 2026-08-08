import React, { useState, useMemo, useRef } from "react";
import * as db from "./data.js";
import { C, Ticket, Btn, Field, inputStyle } from "./ui.jsx";

const uid = () => Math.random().toString(36).slice(2, 10);

export const TONES = { muted: C.mutedDim, amber: C.amber, teal: C.teal, red: C.red, brand: C.brand };
export const TONE_BG = { muted: C.surface3, amber: C.amberDim, teal: C.tealDim, red: C.redDim, brand: C.brandDim };
export const TONE_LABELS = { muted: "Cinza", amber: "Âmbar", teal: "Verde-azulado", red: "Vermelho", brand: "Azul" };

export const ROLE_LABEL = { atendimento: "Todo atendimento", admin: "Todo admin" };

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
/* GERENCIAR TEMAS/TAGS (admin) — compartilhado entre Novidades e Alertas  */
/* ---------------------------------------------------------------------- */
export function ThemeManager({ themes, setThemes, onClose }) {
  const [name, setName] = useState("");
  const [tone, setTone] = useState("brand");

  const add = () => {
    if (!name.trim()) return;
    const theme = { id: uid(), name: name.trim(), tone };
    setThemes((ts) => [...ts, theme]);
    db.insertTheme(theme).catch((e) => console.error(e));
    setName("");
  };

  const remove = (id) => {
    setThemes((ts) => ts.filter((t) => t.id !== id));
    db.deleteTheme(id).catch((e) => console.error(e));
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,9,13,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 60, overflowY: "auto" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 14, width: "100%", maxWidth: 420, padding: 24 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: C.text, textTransform: "uppercase", marginBottom: 16 }}>Gerenciar tags</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Nome da tag" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <select style={{ ...inputStyle, width: 110 }} value={tone} onChange={(e) => setTone(e.target.value)}>
            {Object.keys(TONES).map((t) => <option key={t} value={t}>{TONE_LABELS[t]}</option>)}
          </select>
          <Btn onClick={add}>+</Btn>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {themes.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Tag tone={t.tone}>{t.name}</Tag>
              <button onClick={() => remove(t.id)} style={{ marginLeft: "auto", background: "none", border: "none", color: C.mutedDim, cursor: "pointer", fontSize: 12 }}>remover</button>
            </div>
          ))}
          {themes.length === 0 && <div style={{ fontSize: 12, color: C.mutedDim }}>Nenhuma tag criada ainda.</div>}
        </div>
        <Btn variant="ghost" style={{ marginTop: 18, width: "100%", justifyContent: "center" }} onClick={onClose}>Fechar</Btn>
      </div>
    </div>
  );
}

/** Seletor de tags multi-select (chips), compartilhado entre Novidades e Alertas. */
export function TagPicker({ themes, selectedIds, onToggle }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {themes.map((t) => {
        const active = selectedIds.includes(t.id);
        return (
          <label
            key={t.id}
            style={{
              display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer",
              background: active ? TONE_BG[t.tone] : C.surface2, color: active ? TONES[t.tone] : C.muted,
              border: `1px solid ${active ? TONES[t.tone] : C.border}`, borderRadius: 999, padding: "4px 10px", fontWeight: active ? 700 : 500,
            }}
          >
            <input type="checkbox" checked={active} onChange={() => onToggle(t.id)} style={{ margin: 0 }} />
            {t.name}
          </label>
        );
      })}
      {themes.length === 0 && <span style={{ fontSize: 11.5, color: C.mutedDim }}>Nenhuma tag criada ainda.</span>}
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
function Composer({ themes, clients, team, me, role, onPost, onManageThemes }) {
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
            <TagPicker themes={themes} selectedIds={tagIds} onToggle={toggleTag} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <select style={{ ...inputStyle, width: "auto", flex: "1 1 140px" }} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— sem cliente —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {role === "admin" && (
              <button onClick={onManageThemes} style={{ background: "none", border: "none", color: C.brand, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                Gerenciar tags
              </button>
            )}
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.mutedDim, marginBottom: 6, fontWeight: 600 }}>Para</div>
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

/* ---------------------------------------------------------------------- */
/* POST CARD                                                               */
/* ---------------------------------------------------------------------- */
function PostCard({ post, author, tags, client, recipients, team, me, role, onDelete, onFilterTag, reads, replies, onMarkRead, onReply }) {
  const canDelete = post.authorId === me.id || role === "admin";
  return (
    <Ticket style={{ padding: 16, marginBottom: 10, animation: "fluxo-fade-in .25s ease" }}>
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
            {tags.map((t) => <ClickableTag key={t.id} tone={t.tone} onClick={() => onFilterTag(t.id)}>{t.name}</ClickableTag>)}
            {client && <Tag tone="muted">{client.name}</Tag>}
            {post.audience === "pessoas" && (
              <Tag tone="brand">Para: {recipients.map((id) => team.find((t) => t.id === id)?.name).filter(Boolean).join(", ") || "—"}</Tag>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
            <RepliesThread replies={replies} team={team} me={me} onReply={onReply} />
            <ReadReceipts reads={reads} team={team} me={me} onMarkRead={onMarkRead} />
          </div>
        </div>
      </div>
    </Ticket>
  );
}

/* ---------------------------------------------------------------------- */
/* NOVIDADES VIEW                                                          */
/* ---------------------------------------------------------------------- */
export function NovidadesView({
  posts, setPosts, postRecipients, setPostRecipients, postTags, setPostTags,
  postReads, setPostReads, postReplies, setPostReplies,
  themes, setThemes, clients, team, me, role,
}) {
  const [filterTag, setFilterTag] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterMode, setFilterMode] = useState("tudo"); // tudo | meu | postei
  const [showThemeManager, setShowThemeManager] = useState(false);

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

  return (
    <div>
      <style>{`@keyframes fluxo-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 800, color: C.text, margin: 0, textTransform: "uppercase", letterSpacing: 0.3 }}>
            Novidades
          </h1>
          <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 0" }}>Comunicação interna do time — como uma linha do tempo</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["tudo", "Tudo"], ["meu", "Só pra mim"], ["postei", "Que eu postei"]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilterMode(id)}
              style={{
                background: filterMode === id ? C.brand : C.surface2, color: filterMode === id ? "#fff" : C.muted,
                border: `1px solid ${filterMode === id ? C.brand : C.border}`, borderRadius: 999, padding: "6px 14px",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif",
              }}
            >
              {label}
            </button>
          ))}
          <select style={{ ...inputStyle, width: "auto" }} value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
            <option value="">Todas as tags</option>
            {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select style={{ ...inputStyle, width: "auto" }} value={filterClient} onChange={(e) => setFilterClient(e.target.value)}>
            <option value="">Todos os clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <Composer themes={themes} clients={clients} team={team} me={me} role={role} onPost={publish} onManageThemes={() => setShowThemeManager(true)} />

      {visiblePosts.length === 0 && (
        <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: "40px 20px", textAlign: "center", color: C.mutedDim, fontSize: 13 }}>
          Nenhuma novidade por aqui ainda. Seja o primeiro a postar algo pro time.
        </div>
      )}
      {visiblePosts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          author={team.find((t) => t.id === post.authorId)}
          tags={(tagsByPost[post.id] || []).map((tid) => themes.find((t) => t.id === tid)).filter(Boolean)}
          client={clients.find((c) => c.id === post.clientId)}
          recipients={recipientsByPost[post.id] || []}
          team={team}
          me={me}
          role={role}
          onDelete={remove}
          onFilterTag={setFilterTag}
          reads={readsByPost[post.id] || []}
          replies={repliesByPost[post.id] || []}
          onMarkRead={() => markRead(post.id)}
          onReply={(text) => reply(post.id, text)}
        />
      ))}

      {showThemeManager && <ThemeManager themes={themes} setThemes={setThemes} onClose={() => setShowThemeManager(false)} />}
    </div>
  );
}
