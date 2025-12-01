import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

let cachedStatuses = null;

export async function decodeStatus(statusId) {
  if (!statusId) return "—";

  // 🔹 Cache dictionary to avoid hitting the API for every record
  if (!cachedStatuses) {
    console.log("📥 Fetching property statuses from Zabun...");
    const res = await fetch("https://public.api-cms.zabun.be/api/v1/property/status", {
      headers: {
        "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
        "client_id": process.env.ZABUN_CLIENT_ID,
        "server_id": process.env.ZABUN_SERVER_ID,
        "api_key": process.env.ZABUN_API_KEY,
        "Accept": "application/json",
        "Accept-Language": "nl",
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      console.error(`❌ Failed to fetch statuses: ${res.status} ${res.statusText}`);
      return "—";
    }

    cachedStatuses = await res.json();
  }

  const match = cachedStatuses.find(s => s.id === statusId);

  if (!match) {
    console.warn(`⚠️ Status not found for ID ${statusId}`);
    return String(statusId); // return numeric ID as fallback
  }

  return match.name?.nl ?? match.name?.en ?? "—";
}
