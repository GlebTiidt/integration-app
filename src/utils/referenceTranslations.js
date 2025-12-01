const FACILITY_TRANSLATIONS = new Map(
  [
    ["electricity", "Elektriciteit"],
    ["elektriciteit", "Elektriciteit"],
    ["natural gas", "Aardgas"],
    ["naturalgas", "Aardgas"],
    ["aardgas", "Aardgas"],
    ["city water", "Stadswater"],
    ["citywater", "Stadswater"],
    ["stadswater", "Stadswater"],
    ["rain water", "Regenwater"],
    ["rainwater", "Regenwater"],
    ["regenwater", "Regenwater"],
    ["telephone", "Telefoon"],
    ["telefoon", "Telefoon"],
    ["spring water", "Bronwater"],
    ["springwater", "Bronwater"],
    ["bronwater", "Bronwater"],
    ["distribution", "Distributie"],
    ["distributie", "Distributie"],
    ["fuel oil", "Stookolie"],
    ["fueloil", "Stookolie"],
    ["stookolie", "Stookolie"],
    ["alarm", "Alarm"],
    ["sewerage", "Riolering"],
    ["riolering", "Riolering"],
    ["air-conditioning", "Airco"],
    ["air conditioning", "Airco"],
    ["airco", "Airco"],
    ["internet", "Internet"],
    ["domotics", "Domotica"],
    ["home automation", "Domotica"],
    ["domotics / home automation", "Domotica"],
    ["videophone", "Videofoon"],
    ["video phone", "Videofoon"],
    ["videofoon", "Videofoon"],
    ["fiber", "Fiber (glasvezel)"],
    ["fiber (glasvezel)", "Fiber (glasvezel)"],
    ["fiber optics", "Fiber (glasvezel)"],
    ["solar panels", "Zonnepanelen"],
    ["solarpanels", "Zonnepanelen"],
    ["zonnepanelen", "Zonnepanelen"],
    ["underfloor heating", "Vloerverwarming"],
    ["vloerverwarming", "Vloerverwarming"],
    ["septic tank", "Septische put"],
    ["septic", "Septische put"],
    ["septische put", "Septische put"],
    ["heat pump", "Warmtepomp"],
    ["warmptepomp", "Warmtepomp"],
    ["warmtepomp", "Warmtepomp"],
    ["solar thermal collector", "Zonneboiler"],
    ["solar boiler", "Zonneboiler"],
    ["zonneboiler", "Zonneboiler"],
    ["jacuzzi", "Jacuzzi"],
    ["intercom", "Parlofoon"],
    ["parlofoon", "Parlofoon"]
  ]
);

const ENVIRONMENT_TRANSLATIONS = new Map(
  [
    ["authentic", "Ambachtelijk"],
    ["craft", "Ambachtelijk"],
    ["crafts", "Ambachtelijk"],
    ["ambachtelijk", "Ambachtelijk"],
    ["center", "Centrum"],
    ["centre", "Centrum"],
    ["centrum", "Centrum"],
    ["commercial", "Commercieel"],
    ["commercial area", "Commercieel"],
    ["commercieel", "Commercieel"],
    ["lively location", "Drukke ligging"],
    ["village", "Dorp"],
    ["dorp", "Dorp"],
    ["busy location", "Drukke ligging"],
    ["busy", "Drukke ligging"],
    ["drukke ligging", "Drukke ligging"],
    ["business district", "Handelswijk"],
    ["commercial district", "Handelswijk"],
    ["handelswijk", "Handelswijk"],
    ["industrial park", "Industriepark"],
    ["industriepark", "Industriepark"],
    ["rural", "Landelijk"],
    ["countryside", "Landelijk"],
    ["landelijk", "Landelijk"],
    ["near school", "Omgeving school"],
    ["in the neighbourhood of schools", "Omgeving school"],
    ["in the neighborhood of schools", "Omgeving school"],
    ["omgeving school", "Omgeving school"],
    ["peaceful", "Rustig"],
    ["calm", "Rustig"],
    ["rustig", "Rustig"],
    ["city center", "Stadskern"],
    ["city centre", "Stadskern"],
    ["heart of the centre", "Stadskern"],
    ["heart of the center", "Stadskern"],
    ["stadskern", "Stadskern"],
    ["city edge", "Stadsrand"],
    ["suburb", "Stadsrand"],
    ["stadsrand", "Stadsrand"],
    ["villa district", "Villawijk"],
    ["residentiel area", "Villawijk"],
    ["villawijk", "Villawijk"],
    ["residential core", "Woonkern"],
    ["core of residential area", "Woonkern"],
    ["residential area", "Woonkern"],
    ["residentiel area", "Woonkern"],
    ["woon kern", "Woonkern"],
    ["woon kern", "Woonkern"],
    ["sea/beach/dunes", "Zee/Strand/Duinen"],
    ["sea beach dunes", "Zee/Strand/Duinen"],
    ["zee/strand/duinen", "Zee/Strand/Duinen"],
    ["dike", "Zeedijk"],
    ["dyke", "Zeedijk"],
    ["seadyke", "Zeedijk"],
    ["sea dyke", "Zeedijk"],
    ["zeedijk", "Zeedijk"]
  ]
);

function translateWithMap(label, map) {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  return map.get(normalized) || label.trim();
}

export function translateFacilityLabel(label) {
  return translateWithMap(label, FACILITY_TRANSLATIONS);
}

export function translateEnvironmentLabel(label) {
  return translateWithMap(label, ENVIRONMENT_TRANSLATIONS);
}

 export { FACILITY_TRANSLATIONS, ENVIRONMENT_TRANSLATIONS };
