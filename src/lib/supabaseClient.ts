import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseConfigured) {
  console.error("Supabase configuration missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
}

// Use a harmless placeholder client when env vars are missing so imports never crash the app bootstrap.
const bootstrapUrl = supabaseUrl || "https://placeholder.supabase.co";
const bootstrapAnonKey =
  supabaseAnonKey ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.payload.signature";

export const supabase = createClient(bootstrapUrl, bootstrapAnonKey, {
  global: {
    fetch: (input, init) => {
      return fetch(input, { ...(init ?? {}), cache: "no-store" });
    },
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "sft-gaz-auth",
  },
});
