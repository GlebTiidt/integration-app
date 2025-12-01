import fs from "fs";
import fetch from "node-fetch";

const API_URL = "https://public.api-cms.zabun.be/api/v1/geo/cities";

function getCacheFile(countryId) {
  return `src/cache/cities_${countryId}.json`;
}

export async function loadCities(countryId) {
  const CACHE_FILE = getCacheFile(countryId);

  // Используем кэш если не старше 24 часов
  if (fs.existsSync(CACHE_FILE)) {
    const stat = fs.statSync(CACHE_FILE);
    const age = Date.now() - stat.mtimeMs;
    if (age < 24 * 60 * 60 * 1000) {
      console.log(`🧠 Using cached cities for country ${countryId}`);
      return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    }
  }

  console.log(`🌐 Fetching cities for country ${countryId} from Zabun...`);
  const res = await fetch(`${API_URL}?country_geo_id=${countryId}`, {
    headers: {
      "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
      "client_id": process.env.ZABUN_CLIENT_ID,
      "server_id": process.env.ZABUN_SERVER_ID,
      "api_key": process.env.ZABUN_API_KEY,
      "city_geo_id": countryId,
      "Accept": "application/json",
      "Accept-Language": "nl",
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) throw new Error(`Failed to fetch cities: ${res.statusText}`);

  const data = await res.json();
  const cities = Array.isArray(data) ? data : data.cities || [];

  fs.mkdirSync("src/cache", { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cities, null, 2));

  return cities;
}

export async function decodeCity(cityId, countryId = 23) {
  console.log(`🏙️ Looking for city ID: ${cityId} (country ${countryId})`);
  const cities = await loadCities(countryId);

  const match = cities.find(c => c.city_geo_id === cityId);
  if (!match) {
    console.log(`⚠️ City not found for ID ${cityId}`);
    return { name: "N/A", zip: "" };
  }

  // приоритет — нидерландский язык
  let localized = match.alias?.find(a => a.lang === "NL")?.alias;
  if (!localized && Array.isArray(match.alias) && match.alias.length) {
    localized = match.alias[0].alias;
  }

  const source = localized || match.city_full || match.city;

  // Извлекаем ZIP если он присутствует в скобках
  const zipFromString = (() => {
    const m = source?.match(/\((\d{3,})\)/);
    return m ? m[1] : "";
  })();

  const cleanName = source?.replace(/\s*\(\d{3,}\)\s*$/, "") || match.city;
  const zip = match.zip || zipFromString || "";

  console.log(`✅ Found city: ${cleanName} (zip: ${zip || "n/a"})`);

  return { name: cleanName, zip };
}
