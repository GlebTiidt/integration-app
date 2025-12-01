import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const PROJECT_PAYMENTS_URL = "https://public.api-cms.zabun.be/api/v1/property/project_payments";

const projectPaymentsCache = new Map();

function buildHeaders({ propertyId, acceptLanguage = "NL" }) {
  if (!propertyId) {
    throw new Error("propertyId header is required for project payments.");
  }
  return {
    "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
    client_id: process.env.ZABUN_CLIENT_ID,
    server_id: process.env.ZABUN_SERVER_ID,
    api_key: process.env.ZABUN_API_KEY,
    Accept: "application/json",
    "Accept-Language": "nl",
    "Content-Type": "application/json",
    "Accept-Language": acceptLanguage,
    property_id: String(propertyId)
  };
}

export async function fetchProjectPayments(propertyId, options = {}) {
  const { acceptLanguage = "NL" } = options;
  const cacheKey = `${propertyId}|${acceptLanguage}`;

  if (projectPaymentsCache.has(cacheKey)) {
    return projectPaymentsCache.get(cacheKey);
  }

  console.log(
    `🌐 Fetching project payments from Zabun (property ${propertyId}, lang ${acceptLanguage})...`
  );

  const res = await fetch(PROJECT_PAYMENTS_URL, {
    headers: buildHeaders({ propertyId, acceptLanguage })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Project payments fetch failed ${res.status}: ${text || res.statusText}`
    );
  }

  const data = await res.json();
  const list = Array.isArray(data) ? data : [];
  projectPaymentsCache.set(cacheKey, list);
  return list;
}

export function __clearProjectPaymentsCache() {
  projectPaymentsCache.clear();
}
