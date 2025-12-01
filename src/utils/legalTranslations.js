const HERITAGE_TRANSLATIONS = new Map([
  ["protected archaeological monument", "Beschermd archeologisch monument"],
  ["beschermd archeologisch monument", "Beschermd archeologisch monument"],
  ["protected cultural-historical landscape", "Beschermd cultuurhistorisch landschap"],
  ["beschermd cultuurhistorisch landschap", "Beschermd cultuurhistorisch landschap"],
  ["protected village view", "Beschermd dorpsgezicht"],
  ["beschermd dorpsgezicht", "Beschermd dorpsgezicht"],
  ["protected landscape", "Beschermd landschap"],
  ["beschermd landschap", "Beschermd landschap"],
  ["protected monument", "Beschermd monument"],
  ["beschermd monument", "Beschermd monument"],
  ["protected cityscape", "Beschermd stadsgezicht"],
  ["protected city view", "Beschermd stadsgezicht"],
  ["beschermd stadsgezicht", "Beschermd stadsgezicht"],
  ["protected archaeological site", "Beschermde archeologische site"],
  ["beschermde archeologische site", "Beschermde archeologische site"],
  ["protected archaeological zone", "Beschermde archeologische zone"],
  ["beschermde archeologische zone", "Beschermde archeologische zone"],
  ["inventory of archaeological zones", "Inventaris van archeologische zones"],
  ["inventaris van archeologische zones", "Inventaris van archeologische zones"],
  ["inventory of architectural heritage", "Inventaris van bouwkundig erfgoed"],
  ["inventaris van bouwkundig erfgoed", "Inventaris van bouwkundig erfgoed"],
  ["inventory of historic gardens and parks", "Inventaris van historische tuinen en parken"],
  ["inventaris van historische tuinen en parken", "Inventaris van historische tuinen en parken"],
  ["inventory of woody plants with heritage value", "Inventaris van houtige beplantingen met erfgoedwaarde"],
  ["inventaris van houtige beplantingen met erfgoedwaarde", "Inventaris van houtige beplantingen met erfgoedwaarde"],
  ["landscape atlas", "Landschapsatlas"],
  ["landschapsatlas", "Landschapsatlas"]
]);

const TOWN_PLANNING_TRANSLATIONS = new Map([
  ["agricultural area", "Agrarisch gebied"],
  ["agrarisch gebied", "Agrarisch gebied"],
  ["forest area", "Bosgebied"],
  ["bosgebied", "Bosgebied"],
  ["service area", "Dienstverleningsgebied"],
  ["diensten area", "Dienstverleningsgebied"],
  ["dienstverleningsgebied", "Dienstverleningsgebied"],
  ["area with economic activities", "Gebied met economische activiteiten"],
  ["economic activity area", "Gebied met economische activiteiten"],
  ["gebied met economische activiteiten", "Gebied met economische activiteiten"],
  ["area for day recreation", "Gebied voor dagrecreatie"],
  ["gebied voor dagrecreatie", "Gebied voor dagrecreatie"],
  ["area for stay recreation", "Gebied voor verblijfsrecreatie"],
  ["area for overnight recreation", "Gebied voor verblijfsrecreatie"],
  ["gebied voor verblijfsrecreatie", "Gebied voor verblijfsrecreatie"],
  ["areas for community facilities and public services", "Gebieden voor gemeenschapsvoorzieningen en openbaar nut"],
  ["gebied voor community facilities", "Gebieden voor gemeenschapsvoorzieningen en openbaar nut"],
  ["gebieden voor gemeenschapsvoorzieningen en openbaar nut", "Gebieden voor gemeenschapsvoorzieningen en openbaar nut"],
  ["mixed residential area", "Gemengd woongebied"],
  ["gemengd woongebied", "Gemengd woongebied"],
  ["green area", "Groengebied"],
  ["groengebied", "Groengebied"],
  ["land reserve area", "Grondreservegebied"],
  ["land reserve zone", "Grondreservegebied"],
  ["grondreservegebied", "Grondreservegebied"],
  ["pending application", "In aanvraag"],
  ["in aanvraag", "In aanvraag"],
  ["industrial area", "Industriegebied"],
  ["industriegebied", "Industriegebied"],
  [
    "industrial area for craft businesses or areas for small and medium-sized enterprises",
    "Industriegebied voor ambachtelijke bedrijven of gebieden voor kleine en middelgrote ondernemingen"
  ],
  [
    "industriegebied voor ambachtelijke bedrijven of gebieden voor kleine en middelgrote ondernemingen",
    "Industriegebied voor ambachtelijke bedrijven of gebieden voor kleine en middelgrote ondernemingen"
  ],
  ["landscape valuable agricultural area", "Landschappelijk waardevol agrarisch gebied"],
  ["landschappelijk waardevol agrarisch gebied", "Landschappelijk waardevol agrarisch gebied"],
  ["nature area", "Natuurgebied"],
  ["natuurgebied", "Natuurgebied"],
  ["nature reserve", "Natuurreservaat"],
  ["natuurreservaat", "Natuurreservaat"],
  ["park area", "Parkgebied"],
  ["parkgebied", "Parkgebied"],
  ["recreation area", "Recreatiegebied"],
  ["recreatiegebied", "Recreatiegebied"],
  ["water-sensitive open space area", "Watergevoelig Openruimtegebied"],
  ["watergevoelig openruimtegebied", "Watergevoelig Openruimtegebied"],
  ["extraction area", "Winningsgebied"],
  ["winningsgebied", "Winningsgebied"],
  ["residential area", "Woongebied"],
  ["woongebied", "Woongebied"],
  [
    "residential area with cultural, historical and/or aesthetic value",
    "Woongebied met cult., historische en/of esthetische waarde"
  ],
  [
    "woongebied met cult., historische en/of esthetische waarde",
    "Woongebied met cult., historische en/of esthetische waarde"
  ],
  ["residential area with rural character", "Woongebied met landelijk karakter"],
  ["wohn gebied met landelijk karakter", "Woongebied met landelijk karakter"],
  ["woongebied met landelijk karakter", "Woongebied met landelijk karakter"],
  ["residential area with recreational character", "Woongebied met recreatief karakter"],
  ["woongebied met recreatief karakter", "Woongebied met recreatief karakter"],
  ["residential parks", "Woonparken"],
  ["residential park", "Woonparken"],
  ["woonparken", "Woonparken"],
  ["residential expansion area", "Woonuitbreidingsgebied"],
  ["woonuitbreidingsgebied", "Woonuitbreidingsgebied"]
]);

const TOWN_PLANNING_VIOLATION_TRANSLATIONS = new Map([
  ["select", "selecteer"],
  ["selecteer", "selecteer"],
  ["administrative coercion imposed", "Bestuursdwang opgelegd"],
  ["bestuursdwang opgelegd", "Bestuursdwang opgelegd"],
  ["summons issued", "Dagvaarding uitgebracht"],
  ["dagvaarding uitgebracht", "Dagvaarding uitgebracht"],
  [
    "no judicial repair measure or administrative measure imposed",
    "Geen rechterlijke herstelmaatregel of bestuurlijke maatregel opgelegd"
  ],
  [
    "no judicial remedial or administrative measure imposed",
    "Geen rechterlijke herstelmaatregel of bestuurlijke maatregel opgelegd"
  ],
  [
    "geen rechterlijke herstelmaatregel of bestuurlijke maatregel opgelegd",
    "Geen rechterlijke herstelmaatregel of bestuurlijke maatregel opgelegd"
  ],
  ["penalty payment order imposed", "Last onder dwangsom opgelegd"],
  ["last onder dwangsom opgelegd", "Last onder dwangsom opgelegd"],
  ["amicable settlement concluded", "Minnelijke schikking aangegaan"],
  ["minnelijke schikking aangegaan", "Minnelijke schikking aangegaan"],
  ["judicial repair measure imposed", "Rechterlijke herstelmaatregel opgelegd"],
  ["rechterlijke herstelmaatregel opgelegd", "Rechterlijke herstelmaatregel opgelegd"]
]);

function normalize(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    return trimmed || null;
  }
  return String(value).trim().toLowerCase() || null;
}

function translateWith(map, value) {
  const key = normalize(value);
  if (!key) return value ?? "";
  return map.get(key) || value;
}

export function translateHeritageLabel(value) {
  return translateWith(HERITAGE_TRANSLATIONS, value);
}

export function translateTownPlanningLabel(value) {
  return translateWith(TOWN_PLANNING_TRANSLATIONS, value);
}

export function translateTownPlanningViolationLabel(value) {
  return translateWith(TOWN_PLANNING_VIOLATION_TRANSLATIONS, value);
}
