import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

let cachedJobTitles = null;

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

async function loadJobTitles() {
  if (cachedJobTitles) return cachedJobTitles;

  console.log("📥 Fetching person job titles from Zabun...");
  const response = await fetch(
    "https://public.api-cms.zabun.be/api/v1/person/job_titles",
    {
      headers: buildHeaders()
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch person job titles ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid payload for person job titles dictionary.");
  }

  cachedJobTitles = data;
  return cachedJobTitles;
}

export async function decodeAgentJobTitle(jobTitleId) {
  if (!jobTitleId) return "—";

  try {
    const jobTitles = await loadJobTitles();
    const match = jobTitles.find(item => item.id === jobTitleId);
    if (!match) {
      console.warn(`⚠️ Unknown agent job title id ${jobTitleId}`);
      return String(jobTitleId);
    }
    return match.name?.nl ?? match.name?.en ?? String(jobTitleId);
  } catch (err) {
    console.error(
      "❌ Job title dictionary lookup failed:",
      err.message || err
    );
    return String(jobTitleId);
  }
}
