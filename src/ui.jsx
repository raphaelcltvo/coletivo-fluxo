import React from "react";

/* ---------------------------------------------------------------------- */
/* THEME — values are CSS custom properties, actual colors set at root     */
/* ---------------------------------------------------------------------- */
export const THEMES = {
  dark: {
    bg: "#12141B", surface: "#1A1E29", surface2: "#212636", surface3: "#2A3044",
    border: "#2C3244", borderLight: "#3A4158", text: "#EDEEF3", muted: "#8890A6",
    mutedDim: "#5C6478", amber: "#E8A33D", amberDim: "#3A2E1A", teal: "#3FD9A4",
    tealDim: "#173328", red: "#EF5B54", redDim: "#3A1E1E",
    brand: "#3D7DFF", brandDim: "#132A56", brandSoft: "#3D7DFF",
  },
  light: {
    bg: "#F5F5F1", surface: "#FFFFFF", surface2: "#F1F1ED", surface3: "#E7E8E3",
    border: "#DDDEDA", borderLight: "#C9CAC5", text: "#1B1D22", muted: "#666A70",
    mutedDim: "#9C9FA4", amber: "#B4700F", amberDim: "#FBEBD6", teal: "#12875A",
    tealDim: "#DEF5E9", red: "#D03F39", redDim: "#FBE1DE",
    brand: "#0A57F5", brandDim: "#E7EEFF", brandSoft: "#0A57F5",
  },
};
export const VAR_KEYS = Object.keys(THEMES.dark);
export const C = Object.fromEntries(VAR_KEYS.map((k) => [k, `var(--c-${k})`]));
export const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');`;

export const Ticket = ({ children, style, ...rest }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, position: "relative", ...style }} {...rest}>
    {children}
  </div>
);

export const Btn = ({ children, onClick, variant = "primary", style, disabled, type = "button" }) => {
  const variants = {
    primary: { bg: C.brand, fg: "#FFFFFF", border: "transparent" },
    ghost: { bg: "transparent", fg: C.text, border: C.border },
    danger: { bg: C.redDim, fg: C.red, border: "transparent" },
    subtle: { bg: C.surface3, fg: C.text, border: "transparent" },
  };
  const v = variants[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        background: v.bg, color: v.fg, border: `1px solid ${v.border}`, borderRadius: 8,
        padding: "8px 14px", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        display: "inline-flex", alignItems: "center", gap: 6, transition: "opacity .15s, transform .1s",
        ...style,
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {children}
    </button>
  );
};

export const inputStyle = {
  width: "100%", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
  padding: "9px 11px", color: C.text, fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none", boxSizing: "border-box",
};

export const Field = ({ label, children, hint }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, fontFamily: "Inter, sans-serif", letterSpacing: 0.2 }}>
      {label}
    </label>
    {children}
    {hint && <div style={{ fontSize: 11, color: C.mutedDim, marginTop: 4 }}>{hint}</div>}
  </div>
);
