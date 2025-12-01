import fs from "fs";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const CACHE_DIR = "src/cache";
const API_BASE = "https://public.api-cms.zabun.be/api/v1/geo/countries";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function getCacheFile(countryId) {
  return `${CACHE_DIR}/states_${countryId}.json`;
}

function ensureCacheDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function buildHeaders(countryId) {
  const headers = {
    "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
    client_id: process.env.ZABUN_CLIENT_ID,
    server_id: process.env.ZABUN_SERVER_ID,
    api_key: process.env.ZABUN_API_KEY,
    Accept: "application/json",
    "Accept-Language": "nl",
    "Content-Type": "application/json",
    country_geo_id: String(countryId)
  };
  return headers;
}

function isCacheFresh(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  const age = Date.now() - stat.mtimeMs;
  return age < CACHE_TTL_MS;
}

export async function loadStates(countryId = 23) {
  const cacheFile = getCacheFile(countryId);

  if (isCacheFresh(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      console.log(`🧠 Using cached states for country ${countryId}`);
      return cached;
    } catch (err) {
      console.warn(`⚠️ Failed to read states cache for country ${countryId}:`, err);
    }
  }

  console.log(`🌐 Fetching states for country ${countryId} from Zabun...`);
  const response = await fetch(`${API_BASE}/${countryId}/states`, {
    headers: buildHeaders(countryId)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Failed to fetch states for country ${countryId}: ${response.status} ${text || response.statusText}`
    );
  }

  const data = await response.json();
  const states = Array.isArray(data) ? data : data.states || [];

  ensureCacheDir();
  fs.writeFileSync(cacheFile, JSON.stringify(states, null, 2));

  return states;
}

export async function decodeState(stateGeoId, countryId = 23) {
  if (stateGeoId == null || stateGeoId === "") return null;

  const numericTarget = Number(stateGeoId);
  const states = await loadStates(countryId);

  const match = states.find(entry => {
    if (!entry) return false;
    const entryId =
      entry.state_geo_id ??
      entry.stateGeoId ??
      entry.id ??
      (entry.state && entry.state.id);

    if (entryId == null) return false;
    if (Number.isFinite(numericTarget) && Number(entryId) === numericTarget) {
      return true;
    }
    return String(entryId) === String(stateGeoId);
  });

  if (!match) {
    console.warn(`⚠️ State not found for ID ${stateGeoId} (country ${countryId})`);
    return String(stateGeoId);
  }

  return (
    match.state?.name?.nl ??
    match.state?.name?.en ??
    match.state?.state ??
    match.name?.nl ??
    match.name?.en ??
    match.state ??
    match.label ??
    match.name ??
    String(stateGeoId)
  );
}
