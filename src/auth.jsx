import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";
import { THEMES, VAR_KEYS, C, FONT_IMPORT, Field, inputStyle, Btn, Ring } from "./ui.jsx";

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

const AUTH_CSS = `
${FONT_IMPORT}
.auth-wrap { min-height: 100vh; display: flex; }
.auth-brand {
  flex: 0 0 42%; position: relative; overflow: hidden; background: ${C.brand};
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px; text-align: center;
}
.auth-brand .mural-grid {
  position: absolute; inset: 0; display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 1fr;
}
.auth-brand .mural-grid img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: .9; }
.auth-brand .mural-overlay { position: absolute; inset: 0; background: ${C.brand}; opacity: .82; }
.auth-brand .ring-deco { position: absolute; opacity: 0.16; z-index: 2; }
.auth-brand .ring-deco.r1 { top: -60px; left: -60px; }
.auth-brand .ring-deco.r2 { bottom: -90px; right: -70px; }
.auth-brand .ring-mark { position: relative; z-index: 3; }
.auth-brand .brand-word {
  position: relative; z-index: 3; font-family: 'Barlow Condensed', sans-serif; font-weight: 800;
  font-size: 40px; color: #fff; text-transform: uppercase; letter-spacing: 1.2px; margin-top: 22px; line-height: 1;
  text-shadow: 0 2px 16px rgba(0,0,0,.18);
}
.auth-brand .brand-tag {
  position: relative; z-index: 3; font-size: 12.5px; color: rgba(255,255,255,.85); font-weight: 600;
  letter-spacing: 2px; text-transform: uppercase; margin-top: 8px;
}
.auth-form-col { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 24px; background: ${C.bg}; }
.auth-form-inner { width: 100%; max-width: 360px; }
@media (max-width: 820px) {
  .auth-wrap { flex-direction: column; }
  .auth-brand { flex: 0 0 auto; padding: 32px 20px; min-height: 220px; }
  .auth-brand .brand-word { font-size: 30px; margin-top: 14px; }
  .auth-brand .ring-mark svg { width: 56px; height: 56px; }
  .auth-form-col { padding: 32px 20px 48px; }
}
`;

const MURAL_COUNT = 20;
const muralSrc = (i) => `${import.meta.env.BASE_URL}mural/m${String(i).padStart(2, "0")}.jpg`;

const shellRootVars = (theme) => {
  const rootVars = {};
  VAR_KEYS.forEach((k) => (rootVars[`--c-${k}`] = THEMES[theme][k]));
  return rootVars;
};

function AuthShell({ theme, children }) {
  return (
    <div style={{ ...shellRootVars(theme), fontFamily: "Inter, sans-serif" }}>
      <style>{AUTH_CSS}</style>
      <div className="auth-wrap">
        <div className="auth-brand">
          <div className="mural-grid">
            {Array.from({ length: MURAL_COUNT }, (_, i) => (
              <img key={i} src={muralSrc(i + 1)} alt="" loading="eager" />
            ))}
          </div>
          <div className="mural-overlay" />
          <Ring size={140} color="#fff" stroke={1.6} className="ring-deco r1" />
          <Ring size={200} color="#fff" stroke={1.6} className="ring-deco r2" />
          <div className="ring-mark">
            <Ring size={72} color="#fff" stroke={2} />
          </div>
          <div className="brand-word">Coletivo</div>
          <div className="brand-tag">Fluxo de demandas</div>
        </div>
        <div className="auth-form-col">
          <div className="auth-form-inner">{children}</div>
        </div>
      </div>
    </div>
  );
}

const heading = (title, subtitle) => (
  <div style={{ marginBottom: 26 }}>
    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: 0.3 }}>
      {title}
    </div>
    <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{subtitle}</div>
  </div>
);

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
        {heading("E-mail enviado", "Confira sua caixa de entrada")}
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>
          Se <b>{email}</b> estiver cadastrado, enviamos um e-mail com um link para redefinir a senha.
        </div>
        <Btn variant="ghost" style={{ marginTop: 18, width: "100%", justifyContent: "center" }} onClick={() => setMode("login")}>
          Voltar para o login
        </Btn>
      </AuthShell>
    );
  }

  return (
    <AuthShell theme={theme}>
      {mode === "login" ? heading("Entrar", "Acesse sua conta do Fluxo App") : heading("Redefinir senha", "Vamos te mandar um link por e-mail")}
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
      <div style={{ fontSize: 11.5, color: C.mutedDim, marginTop: 22, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
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
      {heading("Definir senha", "Último passo pra acessar o Fluxo")}
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
