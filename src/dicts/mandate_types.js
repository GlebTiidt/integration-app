import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const MANDATE_TYPES_URL = "https://public.api-cms.zabun.be/api/v1/property/mandate_types";

let cachedMandateTypes = null;

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

async function loadMandateTypes() {
  if (cachedMandateTypes) {
    return cachedMandateTypes;
  }

  console.log("🌐 Fetching mandate types from Zabun...");
  const res = await fetch(MANDATE_TYPES_URL, { headers: buildHeaders() });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mandate types fetch failed ${res.status}: ${text || res.statusText}`);
  }

  const list = await res.json();
  if (!Array.isArray(list)) {
    throw new Error("Invalid mandate types response format.");
  }

  cachedMandateTypes = list;
  return cachedMandateTypes;
}

export async function decodeMandateType(mandateTypeId) {
  if (mandateTypeId == null || mandateTypeId === "") return "—";
  const list = await loadMandateTypes();
  const numericId = Number(mandateTypeId);
  const match = list.find(item => {
    if (item == null) return false;
    if (Number.isFinite(numericId)) return Number(item.id) === numericId;
    return String(item.id) === String(mandateTypeId);
  });

  if (!match) {
    console.warn(`⚠️ Mandate type not found for ID ${mandateTypeId}`);
    return String(mandateTypeId);
  }

  return (
    match.name?.nl ??
    match.name?.en ??
    match.name ??
    String(mandateTypeId)
  );
}

export async function fetchMandateTypes() {
  return loadMandateTypes();
}

export function __clearMandateTypesCache() {
  cachedMandateTypes = null;
}
