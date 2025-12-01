import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const ADMINISTRATIONS_URL = "https://public.api-cms.zabun.be/api/v1/property/administrations";

let cachedAdministrations = null;

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

async function loadAdministrations() {
  if (cachedAdministrations) return cachedAdministrations;

  console.log("🌐 Fetching administration checklist from Zabun...");
  const res = await fetch(ADMINISTRATIONS_URL, { headers: buildHeaders() });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Administrations fetch failed ${res.status}: ${text || res.statusText}`);
  }

  const list = await res.json();
  if (!Array.isArray(list)) {
    throw new Error("Invalid administrations response format.");
  }

  cachedAdministrations = list;
  return cachedAdministrations;
}

export async function decodeAdministration(administrationId) {
  if (administrationId == null || administrationId === "") return "—";
  const list = await loadAdministrations();
  const numericId = Number(administrationId);
  const match = list.find(item => {
    if (item == null) return false;
    if (Number.isFinite(numericId)) return Number(item.id) === numericId;
    return String(item.id) === String(administrationId);
  });

  if (!match) {
    console.warn(`⚠️ Administration checklist item not found for ID ${administrationId}`);
    return String(administrationId);
  }

  return (
    match.name?.nl ??
    match.name?.en ??
    match.name ??
    String(administrationId)
  );
}

export async function fetchAdministrations() {
  return loadAdministrations();
}

export function __clearAdministrationsCache() {
  cachedAdministrations = null;
}
