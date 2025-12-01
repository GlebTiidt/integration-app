import dotenv from "dotenv";
import fetch from "node-fetch";

import { sendToAirtable } from "./upsertAirtable.js";

dotenv.config({ path: ".env" });

function parsePropertyId() {
  const arg = process.argv[2];
  if (!arg) return 4144406;
  const parsed = Number(arg);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  throw new Error(`Invalid property id "${arg}". Provide a numeric ID.`);
}

async function fetchZabunPropertyById(propertyId) {
  const url = `https://public.api-cms.zabun.be/api/v1/property/${propertyId}`;
  const acceptLanguage = process.env.ZABUN_LANGUAGE || "nl";

  const headers = {
    "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
    client_id: process.env.ZABUN_CLIENT_ID,
    server_id: process.env.ZABUN_SERVER_ID,
    api_key: process.env.ZABUN_API_KEY,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Accept-Language": acceptLanguage
  };

  console.log(`🌐 Fetching full property data for ID ${propertyId}...`);
  const response = await fetch(url, { method: "GET", headers });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Zabun API error for ${propertyId}: ${response.status} ${response.statusText} ${text}`
    );
  }

  return response.json();
}

async function run() {
  try {
    const propertyId = parsePropertyId();
    console.log(`🚀 Syncing single property ${propertyId} → Airtable`);
    const property = await fetchZabunPropertyById(propertyId);
    await sendToAirtable(property);
    console.log(`✅ Finished syncing property ${propertyId}`);
  } catch (err) {
    console.error("❌ Single-property sync failed:", err.message || err);
    process.exit(1);
  }
}

run();
