import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

let cachedTitles = null;

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

async function loadTitles() {
  if (cachedTitles) return cachedTitles;

  console.log("📥 Fetching person titles from Zabun...");
  const response = await fetch(
    "https://public.api-cms.zabun.be/api/v1/person/titles",
    {
      headers: buildHeaders()
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch person titles ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid payload for person titles dictionary.");
  }

  cachedTitles = data;
  return cachedTitles;
}

export async function decodeAgentTitle(titleId) {
  if (!titleId) return "—";

  try {
    const titles = await loadTitles();
    const match = titles.find(item => item.id === titleId);
    if (!match) {
      console.warn(`⚠️ Unknown agent title id ${titleId}`);
      return String(titleId);
    }
    return match.name?.nl ?? match.name?.en ?? String(titleId);
  } catch (err) {
    console.error("❌ Title dictionary lookup failed:", err.message || err);
    return String(titleId);
  }
}
