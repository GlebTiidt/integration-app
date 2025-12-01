import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const FINANCIALS_URL = "https://public.api-cms.zabun.be/api/v1/property/financials";

const financialsCache = new Map();

function buildHeaders(propertyId) {
  if (!propertyId) {
    throw new Error("propertyId header is required for financials.");
  }
  return {
    "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
    client_id: process.env.ZABUN_CLIENT_ID,
    server_id: process.env.ZABUN_SERVER_ID,
    api_key: process.env.ZABUN_API_KEY,
    Accept: "application/json",
    "Accept-Language": "nl",
    "Content-Type": "application/json",
    property_id: String(propertyId)
  };
}

export async function fetchPropertyFinancials(propertyId) {
  const cacheKey = String(propertyId);
  if (financialsCache.has(cacheKey)) {
    return financialsCache.get(cacheKey);
  }

  console.log(`🌐 Fetching property financials from Zabun (property ${propertyId})...`);
  const res = await fetch(FINANCIALS_URL, {
    headers: buildHeaders(propertyId)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Financials fetch failed ${res.status}: ${text || res.statusText}`);
  }

  const data = await res.json();
  financialsCache.set(cacheKey, data);
  return data;
}

export function __clearFinancialsCache() {
  financialsCache.clear();
}
