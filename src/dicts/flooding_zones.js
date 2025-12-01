import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const FLOODING_ZONES_URL = "https://public.api-cms.zabun.be/api/v1/property/flooding_zones";

let cachedFloodingZones = null;

function buildHeaders() {
  return {
    "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
    client_id: process.env.ZABUN_CLIENT_ID,
    server_id: process.env.ZABUN_SERVER_ID,
    api_key: process.env.ZABUN_API_KEY,
    Accept: "application/json",
    "Accept-Language": "nl",
    "Content-Type": "application/json"
  };
}

async function loadFloodingZones() {
  if (cachedFloodingZones) return cachedFloodingZones;

  console.log("🌐 Fetching flooding zones from Zabun...");
  const res = await fetch(FLOODING_ZONES_URL, { headers: buildHeaders() });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Flooding zones fetch failed ${res.status}: ${text || res.statusText}`);
  }

  const list = await res.json();
  if (!Array.isArray(list)) {
    throw new Error("Invalid flooding zones response format.");
  }

  cachedFloodingZones = list;
  return cachedFloodingZones;
}

export async function decodeFloodingZone(zoneId) {
  if (zoneId == null || zoneId === "") return "—";
  const list = await loadFloodingZones();
  const numericId = Number(zoneId);
  const match = list.find(item => {
    if (item == null) return false;
    if (Number.isFinite(numericId)) return Number(item.id) === numericId;
    return String(item.id) === String(zoneId);
  });

  if (!match) {
    console.warn(`⚠️ Flooding zone not found for ID ${zoneId}`);
    return String(zoneId);
  }

  return (
    match.name?.nl ??
    match.name?.en ??
    match.name ??
    String(zoneId)
  );
}

export async function fetchFloodingZones() {
  return loadFloodingZones();
}

export function __clearFloodingZonesCache() {
  cachedFloodingZones = null;
}
