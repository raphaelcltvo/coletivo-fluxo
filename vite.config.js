import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANTE: troque "coletivo-fluxo" abaixo pelo nome EXATO do seu repositório no
// GitHub, caso ele seja diferente. O GitHub Pages de projeto serve o site em
// https://SEU-USUARIO.github.io/NOME-DO-REPO/  — e o Vite precisa saber esse
// caminho para os arquivos (JS/CSS) carregarem certo.
//
// Se você for usar um domínio próprio (CNAME) ou um Pages de "usuário"
// (SEU-USUARIO.github.io, sem subpasta), troque para base: "/".
export default defineConfig({
  plugins: [react()],
  base: "/coletivo-fluxo/",
});
