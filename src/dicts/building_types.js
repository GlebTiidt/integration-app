import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

let cache = null;

/**
 * 🏗️ Fetch and cache building types dictionary
 * Endpoint: /api/v1/property/building_types
 */
export async function decodeBuildingType(buildingTypeId) {
  if (!buildingTypeId) return "Unknown";

  // Если уже закэшировано
  if (cache) return cache[buildingTypeId] || "Unknown";

  console.log("🌐 Fetching building types from Zabun...");
  const res = await fetch(`https://public.api-cms.zabun.be/api/v1/property/building_types`, {
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
    console.error(`❌ Failed to fetch building types: ${res.status}`);
    return "Unknown";
  }

  const list = await res.json();

  cache = Object.fromEntries(
    list.map(item => [item.id, item.name?.nl ?? item.name?.en ?? "Unknown"])
  );

  return cache[buildingTypeId] || "Unknown";
}
