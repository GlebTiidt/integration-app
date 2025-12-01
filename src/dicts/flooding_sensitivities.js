import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const FLOODING_SENSITIVITIES_URL = "https://public.api-cms.zabun.be/api/v1/property/flooding_sensitivities";

let cachedFloodingSensitivities = null;

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

async function loadFloodingSensitivities() {
  if (cachedFloodingSensitivities) return cachedFloodingSensitivities;

  console.log("🌐 Fetching flooding sensitivities from Zabun...");
  const res = await fetch(FLOODING_SENSITIVITIES_URL, { headers: buildHeaders() });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Flooding sensitivities fetch failed ${res.status}: ${text || res.statusText}`);
  }

  const list = await res.json();
  if (!Array.isArray(list)) {
    throw new Error("Invalid flooding sensitivities response format.");
  }

  cachedFloodingSensitivities = list;
  return cachedFloodingSensitivities;
}

export async function decodeFloodingSensitivity(sensitivityId) {
  if (sensitivityId == null || sensitivityId === "") return "—";
  const list = await loadFloodingSensitivities();
  const numericId = Number(sensitivityId);
  const match = list.find(item => {
    if (item == null) return false;
    if (Number.isFinite(numericId)) return Number(item.id) === numericId;
    return String(item.id) === String(sensitivityId);
  });

  if (!match) {
    console.warn(`⚠️ Flooding sensitivity not found for ID ${sensitivityId}`);
    return String(sensitivityId);
  }

  return (
    match.name?.nl ??
    match.name?.en ??
    match.name ??
    String(sensitivityId)
  );
}

export async function fetchFloodingSensitivities() {
  return loadFloodingSensitivities();
}

export function __clearFloodingSensitivitiesCache() {
  cachedFloodingSensitivities = null;
}
