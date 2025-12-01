import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const BUILDING_OBLIGATIONS_URL = "https://public.api-cms.zabun.be/api/v1/property/building_obligations";

let cachedBuildingObligations = null;

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

async function loadBuildingObligations() {
  if (cachedBuildingObligations) return cachedBuildingObligations;

  console.log("🌐 Fetching building obligations from Zabun...");
  const res = await fetch(BUILDING_OBLIGATIONS_URL, { headers: buildHeaders() });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Building obligations fetch failed ${res.status}: ${text || res.statusText}`);
  }

  const list = await res.json();
  if (!Array.isArray(list)) {
    throw new Error("Invalid building obligations response format.");
  }

  cachedBuildingObligations = list;
  return cachedBuildingObligations;
}

export async function decodeBuildingObligation(obligationId) {
  if (obligationId == null || obligationId === "") return "—";
  const list = await loadBuildingObligations();
  const numericId = Number(obligationId);
  const match = list.find(item => {
    if (item == null) return false;
    if (Number.isFinite(numericId)) return Number(item.id) === numericId;
    return String(item.id) === String(obligationId);
  });

  if (!match) {
    console.warn(`⚠️ Building obligation not found for ID ${obligationId}`);
    return String(obligationId);
  }

  return (
    match.name?.nl ??
    match.name?.en ??
    match.name ??
    String(obligationId)
  );
}

export async function fetchBuildingObligations() {
  return loadBuildingObligations();
}

export function __clearBuildingObligationsCache() {
  cachedBuildingObligations = null;
}
