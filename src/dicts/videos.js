import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

let cache = null;

// 🎥 Fetch video types dictionary
export async function decodeVideoType(videoTypeId) {
  if (!videoTypeId) return "Unknown";

  // Reuse cache if we already fetched data
  if (cache) {
    return cache[videoTypeId] || "Unknown";
  }

  console.log("🌐 Fetching video types from Zabun...");
  const res = await fetch(`https://public.api-cms.zabun.be/api/v1/property/videos/types`, {
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
    console.error(`❌ Failed to fetch video types: ${res.status}`);
    return "Unknown";
  }

  const list = await res.json();

  // Populate cache map
  cache = Object.fromEntries(
    list.map(item => [item.id, item.name?.nl ?? item.name?.en ?? "Unknown"])
  );

  return cache[videoTypeId] || "Unknown";
}
