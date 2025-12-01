import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const STATIC_HEAD_TYPES = [
  [1, "Apartment"],
  ["1", "Apartment"],
  [2, "Ground"],
  ["2", "Ground"],
  [3, "House"],
  ["3", "House"],
  [4, "Commercial"],
  ["4", "Commercial"],
  [5, "Garage"],
  ["5", "Garage"],
  [6, "Industrial"],
  ["6", "Industrial"],
  [7, "Holiday cottage"],
  ["7", "Holiday cottage"],
  [8, "Other"],
  ["8", "Other"],
  [9, "Project"],
  ["9", "Project"],
  [10, "Office"],
  ["10", "Office"],
  [11, "Assisted living flats"],
  ["11", "Assisted living flats"]
];

let cachedHeadTypes = new Map(STATIC_HEAD_TYPES);

function buildHeaders() {
  return {
    "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
    "client_id": process.env.ZABUN_CLIENT_ID,
    "server_id": process.env.ZABUN_SERVER_ID,
    "api_key": process.env.ZABUN_API_KEY,
    Accept: "application/json",
    "Accept-Language": "nl",
    "Content-Type": "application/json"
  };
}

export async function decodeHeadType(headTypeId) {
  if (headTypeId == null || headTypeId === "") return "Unknown";

  if (cachedHeadTypes.size === STATIC_HEAD_TYPES.length) {
    try {
      console.log("🌐 Fetching head types from Zabun...");
      const res = await fetch(
        "https://public.api-cms.zabun.be/api/v1/property/head_types",
        { headers: buildHeaders() }
      );

      if (!res.ok) {
        console.error(
          `❌ Failed to fetch head types: ${res.status} ${res.statusText}`
        );
      } else {
        const list = await res.json();
        const entries = [...STATIC_HEAD_TYPES];
        if (Array.isArray(list)) {
          for (const item of list) {
            const label = item?.name?.nl ?? item?.name?.en ?? "Unknown";
            const numericId = Number(item?.id);
            if (Number.isFinite(numericId)) {
              entries.push([numericId, label]);
              entries.push([String(numericId), label]);
            } else if (item?.id != null) {
              entries.push([item.id, label]);
            }
          }
        }
        cachedHeadTypes = new Map(entries);
      }
    } catch (err) {
      console.error(
        `❌ Exception fetching head types: ${err.message || err}`
      );
    }
  }

  const numericKey = Number(headTypeId);
  if (Number.isFinite(numericKey) && cachedHeadTypes.has(numericKey)) {
    return cachedHeadTypes.get(numericKey);
  }

  return cachedHeadTypes.get(String(headTypeId)) || "Unknown";
}

export function __clearHeadTypeCache() {
  cachedHeadTypes = new Map(STATIC_HEAD_TYPES);
}
