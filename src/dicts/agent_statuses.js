import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

let cachedStatuses = null;

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

async function loadStatuses() {
  if (cachedStatuses) return cachedStatuses;

  console.log("📥 Fetching person statuses from Zabun...");
  const response = await fetch(
    "https://public.api-cms.zabun.be/api/v1/person/status",
    {
      headers: buildHeaders()
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch person statuses ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid payload for person statuses dictionary.");
  }

  cachedStatuses = data;
  return cachedStatuses;
}

export async function decodeAgentStatus(statusId) {
  if (!statusId) return "—";

  try {
    const statuses = await loadStatuses();
    const match = statuses.find(item => item.id === statusId);
    if (!match) {
      console.warn(`⚠️ Unknown agent status id ${statusId}`);
      return String(statusId);
    }
    return match.name?.nl ?? match.name?.en ?? String(statusId);
  } catch (err) {
    console.error("❌ Status dictionary lookup failed:", err.message || err);
    return String(statusId);
  }
}
