import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

// 🧠 Кэш для всех словарей
let cache = {
  technicals: null,
  dropdownsGlobal: null,
  dropdownsByTechnical: {},
  evaluations: null
};

// =============================================================
// 1️⃣ Основной словарь technicals (например: Roof, Window frame...)
// =============================================================
export async function fetchTechnicals() {
  if (cache.technicals) {
    console.log("🧠 Using cached technicals");
    return cache.technicals;
  }

  console.log("🌐 Fetching technicals from Zabun...");
  const res = await fetch("https://public.api-cms.zabun.be/api/v1/property/technicals", {
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

  if (!res.ok) throw new Error(`Failed to fetch technicals: ${res.status}`);
  const list = await res.json();

  cache.technicals = Object.fromEntries(
    list.map(item => [item.id, item.name?.nl ?? item.name?.en ?? "Unknown"])
  );
  return cache.technicals;
}

// =============================================================
// 2️⃣ Глобальные dropdown-значения для technicals
// =============================================================
export async function fetchTechnicalDropdowns() {
  if (cache.dropdownsGlobal) {
    console.log("🧠 Using cached technical dropdowns");
    return cache.dropdownsGlobal;
  }

  console.log("🌐 Fetching global technical dropdowns from Zabun...");
  const res = await fetch("https://public.api-cms.zabun.be/api/v1/property/technicals/dropdowns", {
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

  if (!res.ok) throw new Error(`Failed to fetch global technical dropdowns: ${res.status}`);
  const list = await res.json();

  cache.dropdownsGlobal = Object.fromEntries(
    list.map(item => [item.id, item.name?.nl ?? item.name?.en ?? "Unknown"])
  );
  return cache.dropdownsGlobal;
}

// =============================================================
// 3️⃣ Индивидуальные dropdown’ы для каждого technical_id
// =============================================================
export async function fetchDropdownsByTechnical(technicalId) {
  if (cache.dropdownsByTechnical[technicalId]) {
    console.log("🧠 Using cached dropdowns for technical_id", technicalId);
    return cache.dropdownsByTechnical[technicalId];
  }

  console.log(`🌐 Fetching dropdowns for technical_id ${technicalId}...`);
  const url = `https://public.api-cms.zabun.be/api/v1/property/technicals/${technicalId}/dropdowns`;

  const res = await fetch(url, {
    headers: {
      "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
      "client_id": process.env.ZABUN_CLIENT_ID,
      "server_id": process.env.ZABUN_SERVER_ID,
      "api_key": process.env.ZABUN_API_KEY,
      "technical_id": String(technicalId), // ⚙️ обязательный хэдер
      Accept: "application/json",
      "Accept-Language": "nl",
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) throw new Error(`Failed to fetch dropdowns for ${technicalId}: ${res.status}`);
  const list = await res.json();

  const dict = Object.fromEntries(
    list.map(item => [item.id, item.name?.nl ?? item.name?.en ?? "Unknown"])
  );
  cache.dropdownsByTechnical[technicalId] = dict;
  return dict;
}

// =============================================================
// 4️⃣ Словарь оценок (Moderate / Good / Very good)
// =============================================================
export async function fetchEvaluations() {
  if (cache.evaluations) {
    console.log("🧠 Using cached evaluations");
    return cache.evaluations;
  }

  console.log("🌐 Fetching evaluations from Zabun...");
  const res = await fetch("https://public.api-cms.zabun.be/api/v1/property/evaluations", {
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

  if (!res.ok) throw new Error(`Failed to fetch evaluations: ${res.status}`);
  const list = await res.json();

  cache.evaluations = Object.fromEntries(
    list.map(item => [item.id, item.name?.nl ?? item.name?.en ?? "Unknown"])
  );
  return cache.evaluations;
}

// =============================================================
// 5️⃣ Главная функция: собирает всё в единый объект technicalSummary
// =============================================================
export async function summarizeTechnicals(technicalsArray = []) {
  if (!Array.isArray(technicalsArray) || !technicalsArray.length) {
    return {};
  }

  console.log("⚙️ Summarizing technicals...");
  const aliasMap = {
    dak: "roof",
    raamwerk: "window_frame",
    beglazing: "glazing",
    verwarming: "heating_system",
    elektriciteit: "electricity",
    loodgieter: "plumber",
    sanitair: "sanitary_fittings",
    isolatie: "isolation",
    keuken: "kitchen"
  };

  // Загружаем все словари параллельно
  const [technicalsDict, evaluationsDict] = await Promise.all([
    fetchTechnicals(),
    fetchEvaluations()
  ]);

  const summary = {};

  for (const item of technicalsArray) {
    const techNameRaw = technicalsDict[item.technical_id] || `technical_${item.technical_id}`;
    const techNameNormalized = techNameRaw
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[()]/g, "")
      .replace(/[^a-z0-9_]/g, ""); // чистим спецсимволы

    const techName = aliasMap[techNameNormalized] || techNameNormalized;

    // Загружаем индивидуальные dropdown’ы для этого technical_id
    const dropdowns = await fetchDropdownsByTechnical(item.technical_id).catch(() => ({}));

    const dropdownValue =
      dropdowns[item.technical_dropdown_id] ||
      `dropdown_${item.technical_dropdown_id || "none"}`;

    const evaluationValue = evaluationsDict[item.evaluation_id] || null;

    // Формируем поля
    if (dropdownValue && dropdownValue !== "dropdown_none") {
      summary[`${techName}_type`] = dropdownValue;
    }
    if (evaluationValue) {
      summary[`${techName}_evaluation`] = evaluationValue;
    }
  }

  console.log("⚙️ Technical summary built:", summary);
  return summary;
}
