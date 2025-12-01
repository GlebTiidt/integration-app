import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const BUILD_STAGES_URL = "https://public.api-cms.zabun.be/api/v1/property/build_stages";

let cachedBuildStages = null;

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

async function loadBuildStages() {
  if (cachedBuildStages) return cachedBuildStages;

  console.log("🌐 Fetching build stages from Zabun...");
  const res = await fetch(BUILD_STAGES_URL, { headers: buildHeaders() });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Build stages fetch failed ${res.status}: ${text || res.statusText}`);
  }

  const list = await res.json();
  if (!Array.isArray(list)) {
    throw new Error("Invalid build stages response format.");
  }

  cachedBuildStages = list;
  return cachedBuildStages;
}

export async function decodeBuildStage(stageId) {
  if (stageId == null || stageId === "") return "—";
  const list = await loadBuildStages();
  const numericId = Number(stageId);
  const match = list.find(item => {
    if (item == null) return false;
    if (Number.isFinite(numericId)) return Number(item.id) === numericId;
    return String(item.id) === String(stageId);
  });

  if (!match) {
    console.warn(`⚠️ Build stage not found for ID ${stageId}`);
    return String(stageId);
  }

  return (
    match.name?.nl ??
    match.name?.en ??
    match.name ??
    String(stageId)
  );
}

export async function fetchBuildStages() {
  return loadBuildStages();
}

export function __clearBuildStagesCache() {
  cachedBuildStages = null;
}
