import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type AnyObject = Record<string, any>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const normalizeApiUrl = (raw: string) => {
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const withoutTrailingSlash = withProtocol.replace(/\/+$/, "");
  return /\/api$/i.test(withoutTrailingSlash) ? withoutTrailingSlash : `${withoutTrailingSlash}/api`;
};

const buildApiCandidates = (raw: string) => {
  const value = String(raw ?? "").trim();
  if (!value) return [];
  if (/^https?:\/\//i.test(value)) return [normalizeApiUrl(value)];
  const httpsCandidate = normalizeApiUrl(`https://${value}`);
  const httpCandidate = normalizeApiUrl(`http://${value}`);
  return Array.from(new Set([httpsCandidate, httpCandidate]));
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (
  input: string,
  init: RequestInit,
  retries = 3,
  timeoutMs = 15000
) => {
  let lastError: Error | null = null;
  for (let i = 0; i < retries; i += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      return response;
    } catch (error: any) {
      clearTimeout(timer);
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < retries - 1) {
        await delay(500 * (i + 1));
      }
    }
  }
  throw lastError ?? new Error("Request failed");
};

const tryExtractHash = (payload: AnyObject) =>
  payload?.user_api_hash ??
  payload?.data?.user_api_hash ??
  payload?.user?.api_hash ??
  payload?.user?.user_api_hash ??
  null;

const login = async (apiBase: string, email: string, password: string) => {
  const loginUrl = `${apiBase}/login`;

  const jsonResponse = await fetchWithRetry(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  }).then((res) => res.json());

  const jsonHash = tryExtractHash(jsonResponse);
  if (jsonHash) return String(jsonHash);

  const formBody = new URLSearchParams({ email, password }).toString();
  const formResponse = await fetchWithRetry(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: formBody,
  }).then((res) => res.json());

  const formHash = tryExtractHash(formResponse);
  if (!formHash) {
    throw new Error("GPSwox login succeeded without user_api_hash");
  }

  return String(formHash);
};

const loadGpsSettingsFromDatabase = async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl) return null;

  const authHeader = req.headers.get("Authorization") ?? "";
  let data: AnyObject | null = null;

  if (serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const result = await admin
      .from("gps_settings")
      .select("api_url,email,password")
      .eq("id", "default")
      .maybeSingle();
    data = (result.data as AnyObject | null) ?? null;
  }

  if (!data && anonKey && authHeader) {
    const userScoped = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const result = await userScoped
      .from("gps_settings")
      .select("api_url,email,password")
      .eq("id", "default")
      .maybeSingle();
    data = (result.data as AnyObject | null) ?? null;
  }

  if (!data) return null;
  return {
    apiUrl: String(data.api_url ?? "").trim(),
    email: String(data.email ?? "").trim(),
    password: String(data.password ?? "").trim(),
  };
};

const getDevices = async (apiBase: string, hash: string) => {
  const getUrl = `${apiBase}/get_devices?user_api_hash=${encodeURIComponent(hash)}&lang=fr`;
  const payload = await fetchWithRetry(getUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  }).then((res) => res.json());

  const roots = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.devices)
        ? payload.devices
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.data?.items)
          ? payload.data.items
          : Array.isArray(payload?.result?.items)
            ? payload.result.items
            : Array.isArray(payload?.result?.devices)
              ? payload.result.devices
              : payload && typeof payload === "object" && payload.devices && typeof payload.devices === "object"
                ? Object.values(payload.devices)
        : [];

  const hasCoordinateShape = (entry: AnyObject) =>
    entry && typeof entry === "object" && (
      "lat" in entry ||
      "latitude" in entry ||
      "lng" in entry ||
      "lon" in entry ||
      "longitude" in entry ||
      "coordinates" in entry ||
      "coordinate" in entry
    );

  const expanded = roots.flatMap((entry: AnyObject) => {
    if (!entry || typeof entry !== "object") return [];
    const nestedItems = Array.isArray(entry.items)
      ? entry.items
      : Array.isArray(entry.devices)
        ? entry.devices
        : null;

    if (nestedItems && nestedItems.length > 0 && !hasCoordinateShape(entry)) {
      const groupTitle = String(entry.title ?? entry.name ?? "");
      return nestedItems.map((item: AnyObject) => ({
        ...(item ?? {}),
        _groupTitle: groupTitle,
      }));
    }

    return [entry];
  });

  const uniqueById = new Map<string, AnyObject>();
  for (const entry of expanded) {
    if (!entry || typeof entry !== "object") continue;
    const key = String(entry?.id ?? entry?.device_id ?? entry?.imei ?? crypto.randomUUID());
    if (!uniqueById.has(key)) {
      uniqueById.set(key, entry);
    }
  }
  const devices = Array.from(uniqueById.values());

  return { raw: payload, devices };
};

const toNumber = (value: any) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const splitCoordinatePair = (value: any) => {
  if (typeof value !== "string") return null;
  const parts = value.split(/[,\s;]+/).map((item) => item.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const lat = toNumber(parts[0]);
  const lng = toNumber(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const pickNumber = (...values: any[]) => {
  for (const value of values) {
    const parsed = toNumber(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const pickString = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
};

const pickBoolean = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "on", "yes", "moving", "online"].includes(normalized)) return true;
      if (["0", "false", "off", "no", "stopped", "offline"].includes(normalized)) return false;
    }
  }
  return null;
};

const deepFindCoordinate = (
  value: any,
  kind: "lat" | "lng",
  depth = 0
): number | null => {
  if (!value || depth > 5) return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = deepFindCoordinate(entry, kind, depth + 1);
      if (Number.isFinite(found)) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;

  const keys = Object.keys(value);
  const targetRegex =
    kind === "lat"
      ? /(latitude|^lat$|_lat$|\.lat$|lastvalidlatitude|last_valid_latitude|position_lat|gps_lat)/i
      : /(longitude|^lng$|^lon$|_lng$|_lon$|\.lng$|\.lon$|lastvalidlongitude|last_valid_longitude|position_lng|position_lon|gps_lng|gps_lon)/i;

  for (const key of keys) {
    if (targetRegex.test(key)) {
      const parsed = toNumber((value as AnyObject)[key]);
      if (Number.isFinite(parsed)) return parsed;
      const fromPair = splitCoordinatePair((value as AnyObject)[key]);
      if (fromPair) return kind === "lat" ? fromPair.lat : fromPair.lng;
    }
  }

  for (const key of keys) {
    const nested = (value as AnyObject)[key];
    const found = deepFindCoordinate(nested, kind, depth + 1);
    if (Number.isFinite(found)) return found;
  }
  return null;
};

const normalizeDevice = (device: AnyObject) => {
  const fromPair =
    splitCoordinatePair(device?.coordinates) ??
    splitCoordinatePair(device?.coordinate) ??
    splitCoordinatePair(device?.position?.coordinates) ??
    splitCoordinatePair(device?.last_valid_coordinates) ??
    splitCoordinatePair(device?.lastValidCoordinates) ??
    splitCoordinatePair(device?.position?.coordinate) ??
    splitCoordinatePair(device?.gps?.coordinates) ??
    splitCoordinatePair(device?.location?.coordinates);

  const lat = fromPair?.lat ?? pickNumber(
    device?.lat,
    device?.latitude,
    device?.position?.lat,
    device?.position?.latitude,
    device?.last_position?.lat,
    device?.last_position?.latitude,
    device?.lastValidLatitude,
    device?.last_valid_latitude,
    device?.last_valid?.lat,
    device?.location?.lat,
    device?.device_data?.lat,
    device?.gps?.lat,
    device?.gps?.latitude,
    deepFindCoordinate(device, "lat")
  );
  const lng = fromPair?.lng ?? pickNumber(
    device?.lng,
    device?.lon,
    device?.longitude,
    device?.position?.lng,
    device?.position?.lon,
    device?.position?.longitude,
    device?.last_position?.lng,
    device?.last_position?.lon,
    device?.last_position?.longitude,
    device?.lastValidLongitude,
    device?.last_valid_longitude,
    device?.last_valid?.lng,
    device?.last_valid?.lon,
    device?.location?.lng,
    device?.location?.lon,
    device?.device_data?.lng,
    device?.gps?.lng,
    device?.gps?.lon,
    device?.gps?.longitude,
    deepFindCoordinate(device, "lng")
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const status =
    typeof device?.online === "boolean"
      ? device.online
        ? "online"
        : "offline"
      : String(device?.status ?? "unknown");

  const speed = pickNumber(
    device?.speed,
    device?.position?.speed,
    device?.last_position?.speed,
    device?.speed_kmh,
    0
  ) ?? 0;
  const moving =
    pickBoolean(
      device?.moving,
      device?.motion,
      device?.is_moving,
      device?.position?.moving,
      device?.position?.motion
    ) ??
    speed > 0;
  const imei = pickString(
    device?.imei,
    device?.device_imei,
    device?.tracker_imei,
    device?.unique_id,
    device?.id
  );
  const plate = pickString(
    device?.plate_number,
    device?.plate,
    device?.plateNo,
    device?.registration,
    device?.vehicle_plate
  );
  const driver = pickString(
    device?.driver_name,
    device?.driver,
    device?.driverName,
    device?.position?.driver_name
  );

  return {
    id: String(device?.id ?? device?.device_id ?? imei ?? crypto.randomUUID()),
    name: String(
      device?.name ??
      device?.plate_number ??
      device?.plate ??
      device?.vehicle_name ??
      device?._groupTitle ??
      device?.imei ??
      "Véhicule"
    ),
    lat,
    lng,
    speed,
    status,
    moving,
    imei,
    plate,
    driver,
    timestamp: String(
      device?.server_time ??
      device?.timestamp ??
      device?.time ??
      device?.position?.time ??
      device?.last_position?.time ??
      device?.datetime ??
      ""
    ),
    raw: device,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let configSource: "database" | "environment" = "environment";
  try {
    const stored = await loadGpsSettingsFromDatabase(req);
    configSource = stored ? "database" : "environment";
    const apiUrlRaw = stored?.apiUrl || (Deno.env.get("GPSWOX_API_URL") ?? "");
    const email = stored?.email || (Deno.env.get("GPSWOX_EMAIL") ?? "");
    const password = stored?.password || (Deno.env.get("GPSWOX_PASSWORD") ?? "");

    if (!apiUrlRaw || !email || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing GPSWOX secrets",
          configSource,
          required: ["GPSWOX_API_URL", "GPSWOX_EMAIL", "GPSWOX_PASSWORD"],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiCandidates = buildApiCandidates(apiUrlRaw);
    if (!apiCandidates.length) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid GPSWOX API URL",
          configSource,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let devices: AnyObject[] = [];
    let selectedApiBase = "";
    let lastConnectionError = "";
    for (const apiBase of apiCandidates) {
      try {
        const hash = await login(apiBase, email, password);
        const payload = await getDevices(apiBase, hash);
        devices = payload.devices;
        selectedApiBase = apiBase;
        break;
      } catch (candidateError: any) {
        lastConnectionError = candidateError?.message ?? String(candidateError ?? "");
      }
    }
    if (!selectedApiBase) {
      throw new Error(`GPS endpoint unreachable (${apiCandidates.join(" | ")}): ${lastConnectionError}`);
    }

    const normalized = devices.map(normalizeDevice).filter(Boolean);
    const droppedCount = Math.max(devices.length - normalized.length, 0);

    return new Response(
      JSON.stringify({
        success: true,
        source: "gpswox",
        configSource,
        apiBase: selectedApiBase,
        fetchedAt: new Date().toISOString(),
        rawDeviceCount: devices.length,
        droppedCount,
        devices: normalized,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message ?? "Unexpected GPSwox error",
        configSource,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
