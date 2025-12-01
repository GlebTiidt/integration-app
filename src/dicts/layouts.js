import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

let cache = null;

// 🧱 Mapping layout → Airtable fields
const LAYOUT_FIELD_MAP = {
  "bedroom": ["bedrooms", "bedroom_area"],
  "swimming pool": ["swimming_pools", "swimming_pool_area"],
  "swimmingpool": ["swimming_pools", "swimming_pool_area"], // alias
  "cellar": ["cellars", "cellar_area"],
  "kitchen": ["kitchens", "kitchen_area"],
  "bathroom": ["bathrooms", "bathroom_area"],
  "garage": ["garages", "garage_area"],
  "living room": ["living_rooms", "living_room_area"],
  "dining room": ["dining_rooms", "dining_room_area"],
  "office": ["offices", "office_area"],
  "terrace": ["terraces", "terrace_area"],
  "attic": ["attics", "attic_area"],
  "garden": ["gardens", "garden_area"],
  "court": ["courts", "court_area"],
  "parking place": ["parking_places", "parking_place_area"],
  "shed": ["sheds", "shed_area"],
  "restroom": ["restrooms", "restroom_area"],
  "sauna": ["saunas", "sauna_area"],
  "fireplace": ["fireplaces", "fireplace_area"],
  "porch": ["porches", "porch_area"],
  "pond": ["ponds", "pond_area"],
  "garden house": ["garden_houses", "garden_house_area"],
  "balcony": ["balconies", "balcony_area"],
  "wine cellar": ["wine_cellars", "wine_cellar_area"],
  "suite": ["suites", "suite_area"],
  "washing room": ["washing_rooms", "washing_room_area"],
  "cupboard": ["cupboards", "cupboard_area"],
  "store cupboard": ["store_cupboards", "store_cupboard_area"],
  "depot": ["depots", "depot_area"],
  "service hall": ["service_halls", "service_hall_area"],
  "video cinema tv room": ["video_cinema_tv_rooms", "video_cinema_tv_room_area"],
  "dressing room": ["dressing_rooms", "dressing_room_area"],
  "showroom": ["showrooms", "showroom_area"],
  "hal": ["hal", "hal_area"],
  "eethoek": ["eethoek", "eethoek_area"],
  // NL aliases
  "badkamer": ["bathrooms", "bathroom_area"],
  "balkon": ["balconies", "balcony_area"],
  "berging": ["sheds", "shed_area"],
  "bureau": ["offices", "office_area"],
  "dienstenhal": ["service_halls", "service_hall_area"],
  "dressing": ["dressing_rooms", "dressing_room_area"],
  "eetkamer": ["dining_rooms", "dining_room_area"],
  "kast": ["cupboards", "cupboard_area"],
  "kelder": ["cellars", "cellar_area"],
  "keuken": ["kitchens", "kitchen_area"],
  "koer": ["courts", "court_area"],
  "open haard": ["fireplaces", "fireplace_area"],
  "parkeerplaats": ["parking_places", "parking_place_area"],
  "opslagruimte": ["depots", "depot_area"],
  "provisiekamer": ["store_cupboards", "store_cupboard_area"],
  "slaapkamer": ["bedrooms", "bedroom_area"],
  "terras": ["terraces", "terrace_area"],
  "toilet": ["restrooms", "restroom_area"],
  "toonzaal": ["showrooms", "showroom_area"],
  "tuin": ["gardens", "garden_area"],
  "tuinhuis": ["garden_houses", "garden_house_area"],
  "veranda": ["porches", "porch_area"],
  "video cinema tv kamer": ["video_cinema_tv_rooms", "video_cinema_tv_room_area"],
  "vijver": ["ponds", "pond_area"],
  "wasplaats": ["washing_rooms", "washing_room_area"],
  "wijnkelder": ["wine_cellars", "wine_cellar_area"],
  "woonkamer": ["living_rooms", "living_room_area"],
  "zolder": ["attics", "attic_area"],
  "zwembad": ["swimming_pools", "swimming_pool_area"]
};

// 🔤 Universal normalization for layout names
function normalizeLayoutName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // заменяем спецсимволы на пробел, чтобы "Video/Cinema" сохраняло разделители
    .replace(/\s+/g, " ") // нормализуем пробелы
    .trim();
}

export async function summarizeLayouts(propertyLayouts = []) {
  if (!Array.isArray(propertyLayouts) || propertyLayouts.length === 0) return {};

  // 📥 Load layouts from Zabun if cache is empty
  if (!cache) {
    console.log("🌐 Fetching layouts from Zabun...");
    const res = await fetch(`https://public.api-cms.zabun.be/api/v1/property/layouts`, {
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
      console.error(`❌ Failed to fetch layouts: ${res.status}`);
      return {};
    }

    const list = await res.json();
    cache = Object.fromEntries(
      list.map(item => [item.id, normalizeLayoutName(item.name?.nl ?? item.name?.en)])
    );
  } else {
    console.log("🧠 Using cached layouts");
  }

  const summary = {};

  // 🧩 Aggregate data for each layout entry
  for (const layout of propertyLayouts) {
    let name = cache[layout.layout_id];

    // 🔁 Fallback — try to use name from property payload if dictionary lookup fails
    const fallbackName = layout.name?.nl ?? layout.name?.en;
    if (!name && fallbackName) {
      name = normalizeLayoutName(fallbackName);
    }

    if (!name) {
      console.warn(`⚠️ Skipped layout without name (id: ${layout.layout_id})`);
      continue;
    }

    const normalizedName = normalizeLayoutName(name);
    const mapping = LAYOUT_FIELD_MAP[normalizedName];

    if (!mapping) {
      console.warn(`⚠️ Skipped unmapped layout: "${normalizedName}"`);
      continue;
    }

    const [countKey, areaKey] = mapping;
    const count = layout.count ?? layout.amount ?? 0;
    const area = layout.surface ?? layout.area ?? 0;

    if (count === 0 && area === 0) continue;

    summary[countKey] = (summary[countKey] || 0) + count;
    summary[areaKey] = (summary[areaKey] || 0) + area;
  }

  // 🏊 Additional fallback: swimming pool is sometimes missing a layout_id
  if (!summary.swimming_pools && propertyLayouts.some(l =>
    l.name?.nl ?? l.name?.en?.toLowerCase().includes("swimming")
  )) {
    const pool = propertyLayouts.find(l =>
      l.name?.nl ?? l.name?.en?.toLowerCase().includes("swimming")
    );
    summary.swimming_pools = pool?.count || 0;
    summary.swimming_pool_area = pool?.surface || pool?.area || 0;
    console.log("💧 Added fallback swimming pool from property layouts");
  }

  return summary;
}
