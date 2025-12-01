import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const PRICE_PERIODS_URL = "https://public.api-cms.zabun.be/api/v1/property/price_periods";

let cachedPricePeriods = null;

function buildHeaders() {
  return {
    "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
    client_id: process.env.ZABUN_CLIENT_ID,
    server_id: process.env.ZABUN_SERVER_ID,
    api_key: process.env.ZABUN_API_KEY,
    Accept: "application/json",
    "Accept-Language": "nl",
    "Content-Type": "application/json"
  };
}

async function loadPricePeriods() {
  if (cachedPricePeriods) {
    return cachedPricePeriods;
  }

  console.log("🌐 Fetching price periods from Zabun...");
  const res = await fetch(PRICE_PERIODS_URL, { headers: buildHeaders() });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Price periods fetch failed ${res.status}: ${text || res.statusText}`);
  }

  const list = await res.json();
  if (!Array.isArray(list)) {
    throw new Error("Invalid price periods response format.");
  }

  cachedPricePeriods = list;
  return cachedPricePeriods;
}

export async function decodePricePeriod(pricePeriodId) {
  if (pricePeriodId == null || pricePeriodId === "") return "—";
  const list = await loadPricePeriods();
  const numericId = Number(pricePeriodId);
  const match = list.find(item => {
    if (item == null) return false;
    if (Number.isFinite(numericId)) return Number(item.id) === numericId;
    return String(item.id) === String(pricePeriodId);
  });

  if (!match) {
    console.warn(`⚠️ Price period not found for ID ${pricePeriodId}`);
    return String(pricePeriodId);
  }

  return (
    match.name?.nl ??
    match.name?.en ??
    match.name ??
    String(pricePeriodId)
  );
}

export async function fetchPricePeriods() {
  return loadPricePeriods();
}

export function __clearPricePeriodsCache() {
  cachedPricePeriods = null;
}
