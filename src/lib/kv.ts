import { supabase, supabaseConfigured } from "./supabaseClient";

async function currentUserId(): Promise<string | null> {
  if (!supabaseConfigured) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function kvUpsertShared(key: string, value: unknown, updated_at: string): Promise<void> {
  const { data: updatedRows, error: updateError } = await supabase
    .from("app_state")
    .update({ value, updated_at })
    .eq("key", key)
    .select("key");

  if (updateError) {
    console.error("Supabase sync error:", updateError.message);
    return;
  }

  if (updatedRows && updatedRows.length > 0) return;

  const { error: insertError } = await supabase.from("app_state").insert({ key, value, updated_at });
  if (insertError) console.error("Supabase sync error:", insertError.message);
}

async function kvUpsertPerUser(key: string, user_id: string, value: unknown, updated_at: string): Promise<void> {
  const { data: updatedRows, error: updateError } = await supabase
    .from("app_state")
    .update({ value, updated_at })
    .eq("key", key)
    .eq("user_id", user_id)
    .select("key");

  if (updateError) {
    const msg = updateError.message.toLowerCase();
    if (msg.includes("user_id")) {
      await kvUpsertShared(key, value, updated_at);
      return;
    }
    console.error("Supabase sync error:", updateError.message);
    return;
  }

  if (updatedRows && updatedRows.length > 0) return;

  const { error: insertError } = await supabase.from("app_state").insert({ key, value, user_id, updated_at });
  if (!insertError) return;

  const msg = insertError.message.toLowerCase();
  if (msg.includes("user_id")) {
    await kvUpsertShared(key, value, updated_at);
    return;
  }
  console.error("Supabase sync error:", insertError.message);
}

export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  if (!supabaseConfigured) return null;
  const uid = await currentUserId();
  if (uid) {
    const { data, error } = await supabase
      .from("app_state")
      .select("value")
      .eq("key", key)
      .eq("user_id", uid)
      .limit(1);

    const msg = (error as any)?.message?.toLowerCase?.() ?? "";
    if (error && msg.includes("user_id")) {
      // Table has no user_id column — fall back to shared read
      const { data: shared, error: sharedErr } = await supabase
        .from("app_state")
        .select("value")
        .eq("key", key)
        .limit(1);
      if (sharedErr) return null;
      return (shared?.[0]?.value as T) ?? null;
    }
    if (error) {
      console.error("Supabase kvGet error:", error.message);
      return null;
    }
    // Strict: only return the user's own data (null if no row)
    return (data?.[0]?.value as T) ?? null;
  }

  // Not authenticated — read shared row
  const { data, error } = await supabase.from("app_state").select("value").eq("key", key).limit(1);
  if (error) {
    console.error("Supabase kvGet error:", error.message);
    return null;
  }
  return (data?.[0]?.value as T) ?? null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  if (!supabaseConfigured) return;
  const uid = await currentUserId();
  const updated_at = new Date().toISOString();

  if (uid) {
    await kvUpsertPerUser(key, uid, value, updated_at);
    return;
  }

  await kvUpsertShared(key, value, updated_at);
}

export async function kvGetShared<T = unknown>(key: string): Promise<T | null> {
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase.from("app_state").select("value").eq("key", key).limit(1);
  if (error) {
    console.error("Supabase kvGetShared error:", error.message);
    return null;
  }
  return (data?.[0]?.value as T) ?? null;
}

export async function kvSetShared(key: string, value: unknown): Promise<void> {
  if (!supabaseConfigured) return;
  const updated_at = new Date().toISOString();
  await kvUpsertShared(key, value, updated_at);
}
