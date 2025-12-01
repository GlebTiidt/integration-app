import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

let cachedTypes = null;

async function ensureTypesLoaded() {
  if (cachedTypes) return cachedTypes;

  console.log("📥 Fetching property types from Zabun...");
  const res = await fetch("https://public.api-cms.zabun.be/api/v1/property/types", {
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
    throw new Error(`Failed to fetch types: ${res.status} ${res.statusText}`);
  }

  const list = await res.json();
  if (!Array.isArray(list)) {
    throw new Error("Invalid response format for property types");
  }
  cachedTypes = list;
  return cachedTypes;
}

function findTypeEntry(typeId) {
  if (typeId == null || typeId === "") return null;
  const numeric = Number(typeId);
  const types = cachedTypes || [];
  const entry = types.find(item => {
    if (item == null) return false;
    const rawId = item.id;
    if (rawId == null) return false;
    if (Number.isFinite(numeric) && Number(rawId) === numeric) return true;
    return String(rawId) === String(typeId);
  });
  return entry || null;
}

/**
 * Декодирует type_id в название типа объекта (например "Apartment", "Villa", "Garage")
 * @param {number} typeId - ID из Zabun property.type_id
 * @returns {Promise<string>} Название типа
 */
export async function decodeType(typeId) {
  if (!typeId) return "—";

  try {
    await ensureTypesLoaded();
  } catch (err) {
    console.error(`❌ Failed to fetch types: ${err.message || err}`);
    return "—";
  }

  const match = findTypeEntry(typeId);
  if (!match) {
    console.warn(`⚠️ Type not found for ID ${typeId}`);
    return String(typeId);
  }

  return match.name?.nl ?? match.name?.en ?? "—";
}

export async function getTypeHeadTypeId(typeId) {
  if (!typeId) return null;
  try {
    await ensureTypesLoaded();
  } catch (err) {
    console.error(`❌ Failed to fetch types for head type lookup: ${err.message || err}`);
    return null;
  }
  const match = findTypeEntry(typeId);
  if (!match) return null;
  return (
    match.head_type_id ??
    match.headTypeId ??
    match.headTypeID ??
    match.headType ??
    null
  );
}
