import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

let cache = null;

async function loadFacilitiesCatalog() {
  if (cache) {
    console.log("🧠 Using cached facilities");
    return cache;
  }

  console.log("🌐 Fetching facilities from Zabun...");
  const res = await fetch(`https://public.api-cms.zabun.be/api/v1/property/facilities`, {
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
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch facilities: ${res.status} ${res.statusText} ${text}`
    );
  }

  cache = await res.json();
  return cache;
}

export async function decodeFacilities(facilitiesArray) {
  if (!Array.isArray(facilitiesArray) || facilitiesArray.length === 0) return [];

  let catalog = [];
  try {
    catalog = await loadFacilitiesCatalog();
  } catch (err) {
    console.error(`❌ Unable to load facilities catalog: ${err.message || err}`);
    return [];
  }

  const ids = facilitiesArray.filter(f => f.active).map(f => f.facility_id);
  return catalog
    .filter(f => ids.includes(f.id))
    .map(f => f.name?.nl ?? f.name?.en ?? "Unknown");
}

export async function getAllFacilities() {
  try {
    const catalog = await loadFacilitiesCatalog();
    return catalog ?? [];
  } catch (err) {
    console.error(`❌ Unable to load facilities catalog: ${err.message || err}`);
    return [];
  }
}
