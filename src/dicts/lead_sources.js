import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const LEAD_SOURCES_URL = "https://public.api-cms.zabun.be/api/v1/property/lead_sources";

let cachedLeadSources = null;

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

async function loadLeadSources() {
  if (cachedLeadSources) return cachedLeadSources;

  console.log("🌐 Fetching lead sources from Zabun...");
  const res = await fetch(LEAD_SOURCES_URL, { headers: buildHeaders() });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Lead sources fetch failed ${res.status}: ${text || res.statusText}`);
  }

  const list = await res.json();
  if (!Array.isArray(list)) {
    throw new Error("Invalid lead sources response format.");
  }

  cachedLeadSources = list;
  return cachedLeadSources;
}

export async function decodeLeadSource(leadSourceId) {
  if (leadSourceId == null || leadSourceId === "") return "—";
  const list = await loadLeadSources();
  const numericId = Number(leadSourceId);
  const match = list.find(item => {
    if (item == null) return false;
    if (Number.isFinite(numericId)) return Number(item.id) === numericId;
    return String(item.id) === String(leadSourceId);
  });

  if (!match) {
    console.warn(`⚠️ Lead source not found for ID ${leadSourceId}`);
    return String(leadSourceId);
  }

  return (
    match.name?.nl ??
    match.name?.en ??
    match.name ??
    String(leadSourceId)
  );
}

export async function fetchLeadSources() {
  return loadLeadSources();
}

export function __clearLeadSourcesCache() {
  cachedLeadSources = null;
}
