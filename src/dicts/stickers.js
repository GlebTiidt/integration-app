import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

let cache = null;

/**
 * 🏷️ Fetch and cache stickers dictionary
 * Endpoint: /api/v1/property/stickers
 */
export async function decodeSticker(stickerId) {
  if (stickerId == null) return "N/A";

  // Return cached data if available
  if (cache) return cache[stickerId] || "N/A";

  console.log("🌐 Fetching stickers from Zabun...");

  const res = await fetch(`https://public.api-cms.zabun.be/api/v1/property/stickers`, {
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
    console.error(`❌ Failed to fetch stickers: ${res.status} ${res.statusText}`);
    return "N/A";
  }

  const list = await res.json();
  if (!Array.isArray(list)) {
    console.error("❌ Invalid stickers response payload.");
    return "N/A";
  }

  // Build cache map: { id: "Sticker Name" }
  cache = Object.fromEntries(
    list.map(item => [item.id, item.name?.nl ?? item.name?.en ?? "N/A"])
  );

  return cache[stickerId] || "N/A";
}
