import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const GARDEN_DIRECTIONS_URL = "https://public.api-cms.zabun.be/api/v1/property/garden_directions";

let cachedGardenDirections = null;

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

async function loadGardenDirections() {
  if (cachedGardenDirections) return cachedGardenDirections;

  console.log("🌐 Fetching garden directions from Zabun...");
  const res = await fetch(GARDEN_DIRECTIONS_URL, { headers: buildHeaders() });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Garden directions fetch failed ${res.status}: ${text || res.statusText}`);
  }

  const list = await res.json();
  if (!Array.isArray(list)) {
    throw new Error("Invalid garden directions response format.");
  }

  cachedGardenDirections = list;
  return cachedGardenDirections;
}

export async function decodeGardenDirection(directionId) {
  if (directionId == null || directionId === "") return "—";
  const list = await loadGardenDirections();
  const numericId = Number(directionId);
  const match = list.find(item => {
    if (item == null) return false;
    if (Number.isFinite(numericId)) return Number(item.id) === numericId;
    return String(item.id) === String(directionId);
  });

  if (!match) {
    console.warn(`⚠️ Garden direction not found for ID ${directionId}`);
    return String(directionId);
  }

  return (
    match.name?.nl ??
    match.name?.en ??
    match.name ??
    String(directionId)
  );
}

export async function fetchGardenDirections() {
  return loadGardenDirections();
}

export function __clearGardenDirectionsCache() {
  cachedGardenDirections = null;
}
