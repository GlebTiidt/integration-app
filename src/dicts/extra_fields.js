import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const EXTRA_FIELDS_URL = "https://public.api-cms.zabun.be/api/v1/property/extra_fields";

let cachedExtraFields = null;

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

export async function fetchExtraFields() {
  if (cachedExtraFields) return cachedExtraFields;

  console.log("🌐 Fetching extra fields metadata from Zabun...");
  const res = await fetch(EXTRA_FIELDS_URL, { headers: buildHeaders() });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Extra fields fetch failed ${res.status}: ${text || res.statusText}`);
  }

  const data = await res.json();
  cachedExtraFields = Array.isArray(data) || typeof data === "object" ? data : [];
  return cachedExtraFields;
}

export function __clearExtraFieldsCache() {
  cachedExtraFields = null;
}
