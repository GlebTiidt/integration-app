import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

let cachedEnvironments = null;

async function loadEnvironmentsCatalog() {
  if (cachedEnvironments) {
    console.log("🧠 Using cached environments");
    return cachedEnvironments;
  }

  console.log("🌐 Fetching environments from Zabun...");
  const headers = {
    "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
    "client_id": process.env.ZABUN_CLIENT_ID,
    "server_id": process.env.ZABUN_SERVER_ID,
    "api_key": process.env.ZABUN_API_KEY,
    "Accept": "application/json",
    "Accept-Language": "nl",
  };

  const res = await fetch("https://public.api-cms.zabun.be/api/v1/property/environments", { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch environments: ${res.status} ${res.statusText} ${text}`
    );
  }

  cachedEnvironments = await res.json();
  return cachedEnvironments;
}

export async function decodeEnvironments(envArray = []) {
  if (!Array.isArray(envArray) || envArray.length === 0) return [];

  let catalog = [];
  try {
    catalog = await loadEnvironmentsCatalog();
  } catch (err) {
    console.error(`❌ Unable to load environments catalog: ${err.message || err}`);
    return [];
  }

  // Keep only active environments
  const activeEnvs = envArray.filter(e => e.active);

  // Build array of display names
  const options = activeEnvs.map(e => {
    const match = catalog.find(item => item.id === e.environment_id);
    return {
      name: match?.name?.nl ?? match?.name?.en ?? `Unknown (${e.environment_id})`
    };
  });

  return options;
}

export async function getAllEnvironments() {
  try {
    const catalog = await loadEnvironmentsCatalog();
    return catalog ?? [];
  } catch (err) {
    console.error(`❌ Unable to load environments catalog: ${err.message || err}`);
    return [];
  }
}
