import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

let cache = null;

async function loadHeritageInventory() {
  if (cache) return cache;

  console.log("🌐 Fetching heritage inventory from Zabun...");
  const response = await fetch(
    "https://public.api-cms.zabun.be/api/v1/property/heritage_inventorieds",
    {
      headers: {
        "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
        "client_id": process.env.ZABUN_CLIENT_ID,
        "server_id": process.env.ZABUN_SERVER_ID,
        "api_key": process.env.ZABUN_API_KEY,
        Accept: "application/json",
        "Accept-Language": "nl",
        "Content-Type": "application/json"
      }
    }
  );

  if (!response.ok) {
    console.error(
      `❌ Failed to fetch heritage inventory: ${response.status}`
    );
    cache = {};
    return cache;
  }

  const list = await response.json();
  cache = Object.fromEntries(
    list.map(item => [
      item.id,
      item.name?.nl ?? item.name?.en ?? item.name ?? "Unknown"
    ])
  );
  return cache;
}

export async function decodeHeritage(id) {
  if (id == null) return "Unknown";
  const map = await loadHeritageInventory();
  return map[id] || "Unknown";
}
