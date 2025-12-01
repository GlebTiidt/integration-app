import fs from "fs";
import fetch from "node-fetch";

const CACHE_FILE = "src/cache/countries.json";
const API_URL = "https://public.api-cms.zabun.be/api/v1/geo/countries";

export async function loadCountries() {
  if (fs.existsSync(CACHE_FILE)) {
    const stat = fs.statSync(CACHE_FILE);
    const age = Date.now() - stat.mtimeMs;
    if (age < 24 * 60 * 60 * 1000) {
      console.log("🧠 Using cached countries");
      return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    }
  }

  console.log("🌐 Fetching countries from Zabun...");
  const res = await fetch(API_URL, {
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

  if (!res.ok) throw new Error(`Failed to fetch countries: ${res.statusText}`);

  const data = await res.json();
  const countries = Array.isArray(data) ? data : data.countries || [];
  fs.mkdirSync("src/cache", { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(countries, null, 2));

  return countries;
}

export async function decodeCountry(countryId) {
  console.log("🌍 Looking for country ID:", countryId);
  const countries = await loadCountries();

  const match = countries.find(c => c.country_geo_id === countryId);
  if (!match) {
    console.log(`⚠️ Country not found for ID ${countryId}`);
    return `Unknown Country (${countryId})`;
  }

  let localized = match.alias?.find(a => a.lang === "NL")?.alias;
  if (!localized && Array.isArray(match.alias) && match.alias.length) {
    localized = match.alias[0].alias;
  }

  const finalName = localized || match.country;
  console.log(`✅ Found country: ${finalName}`);

  return finalName;
}
