import React, { useState, useEffect, useRef } from "react";
import * as db from "./data.js";
import { C, Ticket, Btn, inputStyle } from "./ui.jsx";
import { Avatar, timeAgo } from "./threads.jsx";

const uid = () => Math.random().toString(36).slice(2, 10);

/** Reduz as linhas cruas de fluxo_zeus_messages (que incluem rounds de tool-use
 * sem texto e tool_results de plumbing) pra só as falas visíveis do chat. */
function simplifyMessages(rows) {
  const out = [];
  for (const row of rows) {
    const blocks = row.content?.blocks || [];
    const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    const hasImage = blocks.some((b) => b.type === "image");
    if (!text && !hasImage) continue;
    out.push({ id: row.id, role: row.role, text, ui: row.content?.ui || null, createdAt: row.createdAt });
  }
  return out;
}

function ActivityChips({ options, onPick, disabled }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
      {options.map((o) => (
        <button
          key={o.id}
          disabled={disabled}
          onClick={() => onPick(o.label)}
          title={o.description || ""}
          style={{
            background: C.brandDim, color: C.brand, border: `1px solid ${C.brand}`, borderRadius: 999,
            padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: disabled ? "default" : "pointer",
            fontFamily: "Inter, sans-serif", opacity: disabled ? 0.6 : 1,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SheetLinkCard({ onSubmit, disabled }) {
  const [link, setLink] = useState("");
  return (
    <div style={{ marginTop: 10, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, fontWeight: 600 }}>Link da planilha do Google Sheets</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          value={link}
          disabled={disabled}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && link.trim() && onSubmit(link.trim())}
        />
        <Btn disabled={disabled || !link.trim()} onClick={() => onSubmit(link.trim())}>Enviar</Btn>
      </div>
    </div>
  );
}

function ConfirmationCard({ pending, onConfirm, onCancel, disabled }) {
  const { kind, payload } = pending;
  return (
    <div style={{ marginTop: 10, background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>
        Confirmar {kind === "alert" ? "criação de alerta" : "criação de demanda"}
      </div>
      <div style={{ fontSize: 13, color: C.text, display: "grid", gap: 3 }}>
        <div><b>{payload.title}</b></div>
        {kind === "alert" && payload.destinoSummary && <div>Para: {payload.destinoSummary}</div>}
        {kind === "demand" && payload.assigneeName && <div>Responsável: {payload.assigneeName}</div>}
        {payload.clientName && <div>Cliente: {payload.clientName}</div>}
        {payload.description && <div style={{ color: C.muted }}>{payload.description}</div>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Btn disabled={disabled} onClick={onConfirm}>Confirmar</Btn>
        <Btn variant="ghost" disabled={disabled} onClick={onCancel}>Cancelar</Btn>
      </div>
    </div>
  );
}

function DashboardCard({ url }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <div style={{ marginTop: 10, background: C.brandDim, border: `1px solid ${C.brand}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 12, color: C.brand, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>Dashboard pronto</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href={url} target="_blank" rel="noreferrer">
          <Btn>Abrir dashboard</Btn>
        </a>
        <Btn variant="ghost" onClick={copy}>{copied ? "Copiado!" : "Copiar link pra WhatsApp"}</Btn>
      </div>
    </div>
  );
}

function MessageBubble({ msg, onPickActivity, onSubmitLink, onConfirm, onCancel, busy }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexDirection: isUser ? "row-reverse" : "row" }}>
      <Avatar name={isUser ? "Você" : "Zeus"} />
      <div style={{ maxWidth: "78%" }}>
        <div
          style={{
            background: isUser ? C.brand : C.surface2, color: isUser ? "#fff" : C.text,
            borderRadius: 12, padding: "10px 13px", fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap",
          }}
        >
          {msg.text}
        </div>
        {msg.ui?.suggestedActivities?.length > 0 && (
          <ActivityChips options={msg.ui.suggestedActivities} onPick={onPickActivity} disabled={busy} />
        )}
        {msg.ui?.sheetLinkRequest && <SheetLinkCard onSubmit={onSubmitLink} disabled={busy} />}
        {msg.ui?.pendingConfirmation && (
          <ConfirmationCard pending={msg.ui.pendingConfirmation} onConfirm={onConfirm} onCancel={onCancel} disabled={busy} />
        )}
        {msg.ui?.dashboardUrl && <DashboardCard url={msg.ui.dashboardUrl} />}
      </div>
    </div>
  );
}

export function ZeusView({ conversations, setConversations, clients, me }) {
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState([]);
  const [clientId, setClientId] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const openConversation = async (conv) => {
    setActiveId(conv.id);
    setClientId(conv.clientId || "");
    setError("");
    const rows = await db.fetchZeusMessages(conv.id);
    setMessages(simplifyMessages(rows));
  };

  const startNew = () => {
    setActiveId("");
    setMessages([]);
    setClientId("");
    setError("");
  };

  const send = async (text, extra = {}) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    setMessages((ms) => [...ms, { id: uid(), role: "user", text: text.trim(), ui: null }]);
    setInput("");
    try {
      const res = await db.callZeus({ conversationId: activeId || undefined, clientId: clientId || undefined, message: text.trim(), ...extra });
      if (!activeId) {
        setActiveId(res.conversationId);
        setConversations((cs) => [{ id: res.conversationId, title: text.trim().slice(0, 60), clientId, createdBy: me.id, createdAt: Date.now(), updatedAt: Date.now() }, ...cs]);
      } else {
        setConversations((cs) => cs.map((c) => (c.id === activeId ? { ...c, updatedAt: Date.now() } : c)));
      }
      setMessages((ms) => [...ms, { id: uid(), role: "assistant", text: res.reply || "…", ui: res.ui || null }]);
    } catch (e) {
      setError(e.message || "Erro ao falar com o Zeus.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 18, height: "calc(100vh - 110px)" }}>
      <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <Btn onClick={startNew} style={{ width: "100%", justifyContent: "center" }}>+ Nova conversa</Btn>
        <div style={{ overflowY: "auto", flex: 1, display: "grid", gap: 4 }}>
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c)}
              style={{
                textAlign: "left", background: c.id === activeId ? C.surface3 : "transparent", border: "none",
                borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: C.text, fontSize: 12.5,
              }}
            >
              <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
              <div style={{ color: C.mutedDim, fontSize: 11 }}>{timeAgo(c.updatedAt)}</div>
            </button>
          ))}
        </div>
      </div>

      <Ticket style={{ flex: 1, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: C.brand, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif" }}>Z</div>
          <div style={{ fontWeight: 700, color: C.text, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, textTransform: "uppercase" }}>Zeus</div>
          <select style={{ ...inputStyle, width: "auto", marginLeft: "auto" }} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">— sem cliente —</option>
            {clients.map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
          </select>
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          {messages.length === 0 && (
            <div style={{ color: C.mutedDim, fontSize: 13, textAlign: "center", marginTop: 40 }}>
              Puxe um assunto — peça um Dashboard FTW, uma análise de cliente, ou só diga oi.
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              msg={m}
              busy={busy}
              onPickActivity={(label) => send(label)}
              onSubmitLink={(link) => send(link)}
              onConfirm={() => send("Sim, pode confirmar.")}
              onCancel={() => send("Não, cancela essa.")}
            />
          ))}
          {busy && <div style={{ color: C.mutedDim, fontSize: 12.5, paddingLeft: 42 }}>Zeus está pensando…</div>}
          {error && <div style={{ color: C.red, fontSize: 12.5, paddingLeft: 42 }}>{error}</div>}
        </div>

        <div style={{ padding: 14, borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
          <textarea
            style={{ ...inputStyle, flex: 1, minHeight: 40, resize: "none" }}
            placeholder="Escreva pro Zeus..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <Btn disabled={busy || !input.trim()} onClick={() => send(input)}>Enviar</Btn>
        </div>
      </Ticket>
    </div>
  );
}
