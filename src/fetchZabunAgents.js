import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const AGENTS_ENDPOINT =
  process.env.ZABUN_PERSON_URL ||
  "https://public.api-cms.zabun.be/api/v1/person";

function buildHeaders() {
  return {
    "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
    client_id: process.env.ZABUN_CLIENT_ID,
    server_id: process.env.ZABUN_SERVER_ID,
    api_key: process.env.ZABUN_API_KEY,
    Accept: "application/json",
    "Content-Type": "application/json"
  };
}

export async function fetchZabunAgents() {
  console.log("🌐 Fetching Zabun agents...");

  const response = await fetch(AGENTS_ENDPOINT, {
    method: "GET",
    headers: buildHeaders()
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Zabun agents fetch failed: ${response.status} ${response.statusText} — ${text}`
    );
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(
      `Unexpected Zabun agents payload shape. Expected an array but got ${typeof data}.`
    );
  }

  console.log(`📥 Received ${data.length} agents from Zabun.`);
  return data;
}
