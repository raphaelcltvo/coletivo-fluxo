// Substitui window.storage (que só existe dentro do ambiente do Claude) por localStorage
// do navegador, mantendo a mesma "forma" de chamada (get/set/delete/list, tudo async)
// para que o resto do App.jsx não precise mudar.
//
// IMPORTANTE: localStorage é POR NAVEGADOR. Se a Ana Paula abrir o sistema no notebook
// dela, ela não vai ver os dados que você lançou no seu navegador — cada pessoa tem sua
// própria cópia local. Isso é esperado nesta fase (sem backend/banco de dados real).
// Quando vocês quiserem dados compartilhados de verdade entre a equipe, aí sim precisa
// de um servidor com banco de dados por trás.

const PREFIX = "coletivo-fluxo:";

export const storage = {
  async get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return null;
      return { key, value: raw, shared: false };
    } catch (e) {
      return null;
    }
  },

  async set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, value);
      return { key, value, shared: false };
    } catch (e) {
      // localStorage cheio ou bloqueado (ex: modo anônimo em alguns navegadores)
      console.error("Falha ao salvar no localStorage:", e);
      return null;
    }
  },

  async delete(key) {
    try {
      const existed = localStorage.getItem(PREFIX + key) !== null;
      localStorage.removeItem(PREFIX + key);
      return { key, deleted: existed, shared: false };
    } catch (e) {
      return null;
    }
  },

  async list(prefix = "") {
    try {
      const keys = Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX + prefix))
        .map((k) => k.slice(PREFIX.length));
      return { keys, prefix, shared: false };
    } catch (e) {
      return null;
    }
  },
};
