import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copie .env.local.example para .env.local e preencha com os dados do seu projeto Supabase (Project Settings → API)."
  );
}

export const supabase = createClient(url, anonKey);
