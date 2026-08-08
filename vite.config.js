import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// O site roda no domínio próprio fluxoapp.online (ver public/CNAME), então o
// Vite serve tudo a partir da raiz. Se um dia o domínio custom for removido e
// o site voltar a ser servido em https://SEU-USUARIO.github.io/coletivo-fluxo/,
// troque base de volta para "/coletivo-fluxo/".
export default defineConfig({
  plugins: [react()],
  base: "/",
});
