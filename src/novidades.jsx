import React, { useState, useMemo } from "react";
import * as db from "./data.js";
import { C, Ticket, Btn, Field, inputStyle } from "./ui.jsx";

const uid = () => Math.random().toString(36).slice(2, 10);

const TONES = { muted: C.mutedDim, amber: C.amber, teal: C.teal, red: C.red, brand: C.brand };
const TONE_BG = { muted: C.surface3, amber: C.amberDim, teal: C.tealDim, red: C.redDim, brand: C.brandDim };

function timeAgo(ts) {
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

const Avatar = ({ name, size = 32 }) => (
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

const Tag = ({ children, tone = "muted" }) => (
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
/* GERENCIAR TEMAS (admin)                                                 */
/* ---------------------------------------------------------------------- */
function ThemeManager({ themes, setThemes, onClose }) {
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,9,13,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 50, overflowY: "auto" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 14, width: "100%", maxWidth: 420, padding: 24 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: C.text, textTransform: "uppercase", marginBottom: 16 }}>Gerenciar temas</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Nome do tema" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <select style={{ ...inputStyle, width: 110 }} value={tone} onChange={(e) => setTone(e.target.value)}>
            {Object.keys(TONES).map((t) => <option key={t} value={t}>{t}</option>)}
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
          {themes.length === 0 && <div style={{ fontSize: 12, color: C.mutedDim }}>Nenhum tema criado ainda.</div>}
        </div>
        <Btn variant="ghost" style={{ marginTop: 18, width: "100%", justifyContent: "center" }} onClick={onClose}>Fechar</Btn>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* COMPOSER                                                                 */
/* ---------------------------------------------------------------------- */
function Composer({ themes, clients, team, me, role, onPost, onManageThemes }) {
  const [message, setMessage] = useState("");
  const [themeId, setThemeId] = useState("");
  const [clientId, setClientId] = useState("");
  const [audience, setAudience] = useState("todos");
  const [recipientIds, setRecipientIds] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleRecipient = (id) => setRecipientIds((rs) => (rs.includes(id) ? rs.filter((r) => r !== id) : [...rs, id]));

  const publish = async () => {
    if (!message.trim()) return;
    setBusy(true);
    const post = { id: uid(), authorId: me.id, themeId, clientId, audience, message: message.trim(), createdAt: Date.now() };
    const recipients = audience === "pessoas" ? recipientIds : [];
    try {
      await onPost(post, recipients);
      setMessage(""); setThemeId(""); setClientId(""); setAudience("todos"); setRecipientIds([]); setExpanded(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Ticket style={{ padding: 16, marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <Avatar name={me?.name} />
        <textarea
          style={{ ...inputStyle, flex: 1, minHeight: expanded ? 70 : 38, resize: "vertical", transition: "min-height .12s" }}
          placeholder="Compartilhe uma novidade com o time..."
          value={message}
          onFocus={() => setExpanded(true)}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      {expanded && (
        <div style={{ marginTop: 12, paddingLeft: 42 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <select style={{ ...inputStyle, width: "auto", flex: "1 1 140px" }} value={themeId} onChange={(e) => setThemeId(e.target.value)}>
              <option value="">— sem tema —</option>
              {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select style={{ ...inputStyle, width: "auto", flex: "1 1 140px" }} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— sem cliente —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select style={{ ...inputStyle, width: "auto", flex: "1 1 140px" }} value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="todos">Para: Todos</option>
              <option value="pessoas">Para: pessoa(s) específica(s)</option>
            </select>
            {role === "admin" && (
              <button onClick={onManageThemes} style={{ background: "none", border: "none", color: C.brand, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                Gerenciar temas
              </button>
            )}
          </div>
          {audience === "pessoas" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {team.filter((t) => t.status === "ativo" && t.id !== me.id).map((t) => (
                <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.text, background: recipientIds.includes(t.id) ? C.brandDim : C.surface2, border: `1px solid ${C.border}`, borderRadius: 999, padding: "4px 10px", cursor: "pointer" }}>
                  <input type="checkbox" checked={recipientIds.includes(t.id)} onChange={() => toggleRecipient(t.id)} style={{ margin: 0 }} />
                  {t.name}
                </label>
              ))}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn variant="ghost" onClick={() => { setExpanded(false); setMessage(""); }}>Cancelar</Btn>
            <Btn disabled={busy || !message.trim() || (audience === "pessoas" && recipientIds.length === 0)} onClick={publish}>
              {busy ? "Publicando..." : "Publicar"}
            </Btn>
          </div>
        </div>
      )}
    </Ticket>
  );
}

/* ---------------------------------------------------------------------- */
/* POST CARD                                                               */
/* ---------------------------------------------------------------------- */
function PostCard({ post, author, theme, client, recipients, team, me, role, onDelete }) {
  const canDelete = post.authorId === me.id || role === "admin";
  return (
    <Ticket style={{ padding: 16, marginBottom: 10 }}>
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
          <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.5, marginTop: 6, whiteSpace: "pre-wrap" }}>{post.message}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {theme && <Tag tone={theme.tone}>{theme.name}</Tag>}
            {client && <Tag tone="muted">{client.name}</Tag>}
            {post.audience === "pessoas" && (
              <Tag tone="brand">Para: {recipients.map((id) => team.find((t) => t.id === id)?.name).filter(Boolean).join(", ") || "—"}</Tag>
            )}
          </div>
        </div>
      </div>
    </Ticket>
  );
}

/* ---------------------------------------------------------------------- */
/* NOVIDADES VIEW                                                          */
/* ---------------------------------------------------------------------- */
export function NovidadesView({ posts, setPosts, postRecipients, setPostRecipients, themes, setThemes, clients, team, me, role }) {
  const [filterTheme, setFilterTheme] = useState("");
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

  const visiblePosts = useMemo(() => {
    return posts
      .filter((p) => !filterTheme || p.themeId === filterTheme)
      .filter((p) => !filterClient || p.clientId === filterClient)
      .filter((p) => {
        if (filterMode === "postei") return p.authorId === me.id;
        if (filterMode === "meu") return p.authorId === me.id || (recipientsByPost[p.id] || []).includes(me.id);
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [posts, filterTheme, filterClient, filterMode, recipientsByPost, me.id]);

  const publish = async (post, recipientIds) => {
    setPosts((ps) => [post, ...ps]);
    if (recipientIds.length) {
      setPostRecipients((rs) => [...rs, ...recipientIds.map((memberId) => ({ postId: post.id, memberId }))]);
    }
    await db.insertPost(post, recipientIds);
  };

  const remove = (id) => {
    setPosts((ps) => ps.filter((p) => p.id !== id));
    setPostRecipients((rs) => rs.filter((r) => r.postId !== id));
    db.deletePost(id).catch((e) => console.error(e));
  };

  return (
    <div>
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
          <select style={{ ...inputStyle, width: "auto" }} value={filterTheme} onChange={(e) => setFilterTheme(e.target.value)}>
            <option value="">Todos os temas</option>
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
          theme={themes.find((t) => t.id === post.themeId)}
          client={clients.find((c) => c.id === post.clientId)}
          recipients={recipientsByPost[post.id] || []}
          team={team}
          me={me}
          role={role}
          onDelete={remove}
        />
      ))}

      {showThemeManager && <ThemeManager themes={themes} setThemes={setThemes} onClose={() => setShowThemeManager(false)} />}
    </div>
  );
}
