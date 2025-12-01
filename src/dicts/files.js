import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

let cache = null;

// 📁 Fetch file type dictionary
export async function decodeFileType(fileTypeId) {
  if (fileTypeId == null) return "N/A";

  // Используем кэш, если уже был запрос
  if (cache) {
    return cache[fileTypeId] || "N/A";
  }

  console.log("🌐 Fetching file types from Zabun...");
  const res = await fetch(`https://public.api-cms.zabun.be/api/v1/property/files/types`, {
    headers: {
      "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
      "client_id": process.env.ZABUN_CLIENT_ID,
      "server_id": process.env.ZABUN_SERVER_ID,
      "api_key": process.env.ZABUN_API_KEY,
      Accept: "application/json",
      "Accept-Language": "nl",
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    console.error(`❌ Failed to fetch file types: ${res.status}`);
    return "N/A";
  }

  const list = await res.json();
  if (!Array.isArray(list)) {
    console.error("❌ Invalid file types response payload.");
    return "N/A";
  }

  // Создаём кэш
  cache = Object.fromEntries(
    list.map(item => [item.id, item.name?.nl ?? item.name?.en ?? "N/A"])
  );

  return cache[fileTypeId] || "N/A";
}
