import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

let cachedProfiles = null;

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

async function loadProfiles() {
  if (cachedProfiles) return cachedProfiles;

  console.log("📥 Fetching person profiles from Zabun...");
  const response = await fetch(
    "https://public.api-cms.zabun.be/api/v1/person/profile",
    {
      headers: buildHeaders()
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch person profiles ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid payload for person profiles dictionary.");
  }

  cachedProfiles = data;
  return cachedProfiles;
}

export async function decodeAgentProfile(profileId) {
  if (!profileId) return "—";

  try {
    const profiles = await loadProfiles();
    const match = profiles.find(item => item.id === profileId);
    if (!match) {
      console.warn(`⚠️ Unknown agent profile id ${profileId}`);
      return String(profileId);
    }
    return match.name?.nl ?? match.name?.en ?? String(profileId);
  } catch (err) {
    console.error("❌ Profile dictionary lookup failed:", err.message || err);
    return String(profileId);
  }
}
