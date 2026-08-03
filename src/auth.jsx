import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";
import { THEMES, VAR_KEYS, C, FONT_IMPORT, Field, inputStyle, Btn, Ticket } from "./ui.jsx";

/**
 * Sessão do Supabase Auth + o último evento disparado (útil pra distinguir
 * um login normal de alguém que acabou de abrir um link de convite/redefinição
 * de senha — nesse caso o Supabase já cria uma sessão, mas queremos mostrar
 * "defina sua senha" em vez do app direto).
 */
export function useSession() {
  const [session, setSession] = useState(undefined); // undefined = ainda carregando
  const [authEvent, setAuthEvent] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setAuthEvent(event);
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading: session === undefined, authEvent };
}

const shellStyle = (theme) => {
  const rootVars = {};
  VAR_KEYS.forEach((k) => (rootVars[`--c-${k}`] = THEMES[theme][k]));
  return { ...rootVars, minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 20 };
};

function AuthShell({ theme, children }) {
  return (
    <div style={shellStyle(theme)}>
      <style>{FONT_IMPORT}</style>
      <Ticket style={{ padding: 28, width: "100%", maxWidth: 380 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>
          Coletivo · Fluxo
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 22 }}>Controle de demandas da equipe</div>
        {children}
      </Ticket>
    </div>
  );
}

export function Login({ theme = "light" }) {
  const [mode, setMode] = useState("login"); // "login" | "forgot" | "forgot_sent"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!email.trim() || !password) return;
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError("E-mail ou senha incorretos.");
  };

  const handleForgot = async () => {
    setError("");
    if (!email.trim()) { setError("Informe seu e-mail acima primeiro."); return; }
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + import.meta.env.BASE_URL,
    });
    setBusy(false);
    if (err) setError(err.message);
    else setMode("forgot_sent");
  };

  if (mode === "forgot_sent") {
    return (
      <AuthShell theme={theme}>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>
          Se <b>{email}</b> estiver cadastrado, enviamos um e-mail com um link para redefinir a senha.
        </div>
        <Btn variant="ghost" style={{ marginTop: 16, width: "100%", justifyContent: "center" }} onClick={() => setMode("login")}>
          Voltar para o login
        </Btn>
      </AuthShell>
    );
  }

  return (
    <AuthShell theme={theme}>
      <Field label="E-mail">
        <input style={inputStyle} type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@agenciacoletivo.com" />
      </Field>
      {mode === "login" && (
        <Field label="Senha">
          <input
            style={inputStyle}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="••••••••"
          />
        </Field>
      )}
      {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{error}</div>}
      {mode === "login" ? (
        <>
          <Btn disabled={busy || !email.trim() || !password} onClick={handleLogin} style={{ width: "100%", justifyContent: "center" }}>
            {busy ? "Entrando..." : "Entrar"}
          </Btn>
          <button
            onClick={() => { setMode("forgot"); setError(""); }}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", marginTop: 14, padding: 0, display: "block" }}
          >
            Esqueci minha senha
          </button>
        </>
      ) : (
        <>
          <Btn disabled={busy || !email.trim()} onClick={handleForgot} style={{ width: "100%", justifyContent: "center" }}>
            {busy ? "Enviando..." : "Enviar link de redefinição"}
          </Btn>
          <button
            onClick={() => { setMode("login"); setError(""); }}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", marginTop: 14, padding: 0, display: "block" }}
          >
            Voltar para o login
          </button>
        </>
      )}
      <div style={{ fontSize: 11.5, color: C.mutedDim, marginTop: 20, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
        Só quem foi convidado pelo admin (aba Equipe) consegue entrar. Se você acabou de
        receber um convite, use o link do e-mail para definir sua senha antes de logar aqui.
      </div>
    </AuthShell>
  );
}

/** Mostrado quando o usuário chega via link de convite ou de "esqueci minha senha". */
export function SetPassword({ theme = "light", onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (password.length < 8) { setError("Use uma senha com pelo menos 8 caracteres."); return; }
    if (password !== confirm) { setError("As senhas não coincidem."); return; }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) { setError(err.message); return; }
    onDone();
  };

  return (
    <AuthShell theme={theme}>
      <div style={{ fontSize: 13, color: C.text, marginBottom: 16, lineHeight: 1.5 }}>
        Defina sua senha para acessar o Fluxo.
      </div>
      <Field label="Nova senha">
        <input style={inputStyle} type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 8 caracteres" />
      </Field>
      <Field label="Confirmar senha">
        <input
          style={inputStyle}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
      </Field>
      {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{error}</div>}
      <Btn disabled={busy || !password || !confirm} onClick={handleSubmit} style={{ width: "100%", justifyContent: "center" }}>
        {busy ? "Salvando..." : "Salvar senha e entrar"}
      </Btn>
    </AuthShell>
  );
}
