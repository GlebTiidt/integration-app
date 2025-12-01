import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

let cache = null;

/**
 * 🏠 Fetch and cache property condition dictionary
 * Endpoint: /api/v1/property/conditions
 */
export async function decodeCondition(conditionId) {
  if (!conditionId) return "Unknown";

  // Return cached dictionary if already loaded
  if (cache) return cache[conditionId] || "Unknown";

  console.log("🌐 Fetching property conditions from Zabun...");
  const res = await fetch(`https://public.api-cms.zabun.be/api/v1/property/conditions`, {
    headers: {
      "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
      "client_id": process.env.ZABUN_CLIENT_ID,
      "server_id": process.env.ZABUN_SERVER_ID,
      "api_key": process.env.ZABUN_API_KEY,
      Accept: "application/json",
      "Accept-Language": "nl",
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    console.error(`❌ Failed to fetch property conditions: ${res.status}`);
    return "Unknown";
  }

  const list = await res.json();

  cache = Object.fromEntries(
    list.map(item => [item.id, item.name?.nl ?? item.name?.en ?? "Unknown"])
  );

  return cache[conditionId] || "Unknown";
}
