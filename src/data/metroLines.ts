import type { LineStation, TransitLine } from "../types";

/**
 * Static line directories for countries without a live line provider. Metro
 * networks (Singapore, Bangkok) list every open station; intercity HSR
 * networks (China, Germany, France) list major stops only, mirroring the
 * Japan Shinkansen directory. Interchanges are derived from shared station
 * names within each country group.
 */
interface LineDef {
  id: string;
  name: string;
  color: string;
  stations: string[];
}

function buildLines(defs: LineDef[]): TransitLine[] {
  const linesByStation = new Map<string, string[]>();
  for (const line of defs) {
    for (const station of line.stations) {
      const names = linesByStation.get(station) || [];
      if (!names.includes(line.name)) names.push(line.name);
      linesByStation.set(station, names);
    }
  }
  return defs.map((line) => ({
    id: line.id,
    name: line.name,
    color: line.color,
    stations: line.stations.map((station): LineStation => {
      const transfers = (linesByStation.get(station) || []).filter((name) => name !== line.name);
      return { name: station, interchanges: transfers.length > 0 ? transfers : undefined };
    }),
  }));
}

// ---------------------------------------------------------------------------
// Singapore MRT — all open stations (LTA official colours & names).
// ---------------------------------------------------------------------------
const singaporeLineDefs: LineDef[] = [
  {
    id: "sg-nsl",
    name: "North South Line",
    color: "#D42E12",
    stations: [
      "Jurong East", "Bukit Batok", "Bukit Gombak", "Choa Chu Kang", "Yew Tee",
      "Kranji", "Marsiling", "Woodlands", "Admiralty", "Sembawang", "Canberra",
      "Yishun", "Khatib", "Yio Chu Kang", "Ang Mo Kio", "Bishan", "Braddell",
      "Toa Payoh", "Novena", "Newton", "Orchard", "Somerset", "Dhoby Ghaut",
      "City Hall", "Raffles Place", "Marina Bay", "Marina South Pier",
    ],
  },
  {
    id: "sg-ewl",
    name: "East West Line",
    color: "#009645",
    stations: [
      "Pasir Ris", "Tampines", "Simei", "Tanah Merah", "Bedok", "Kembangan",
      "Eunos", "Paya Lebar", "Aljunied", "Kallang", "Lavender", "Bugis",
      "City Hall", "Raffles Place", "Tanjong Pagar", "Outram Park", "Tiong Bahru",
      "Redhill", "Queenstown", "Commonwealth", "Buona Vista", "Dover", "Clementi",
      "Jurong East", "Chinese Garden", "Lakeside", "Boon Lay", "Pioneer",
      "Joo Koon", "Gul Circle", "Tuas Crescent", "Tuas West Road", "Tuas Link",
      "Expo", "Changi Airport",
    ],
  },
  {
    id: "sg-nel",
    name: "North East Line",
    color: "#9900AA",
    stations: [
      "HarbourFront", "Outram Park", "Chinatown", "Clarke Quay", "Dhoby Ghaut",
      "Little India", "Farrer Park", "Boon Keng", "Potong Pasir", "Woodleigh",
      "Serangoon", "Kovan", "Hougang", "Buangkok", "Sengkang", "Punggol",
      "Punggol Coast",
    ],
  },
  {
    id: "sg-ccl",
    name: "Circle Line",
    color: "#FA9E0D",
    stations: [
      "Dhoby Ghaut", "Bras Basah", "Esplanade", "Promenade", "Nicoll Highway",
      "Stadium", "Mountbatten", "Dakota", "Paya Lebar", "MacPherson", "Tai Seng",
      "Bartley", "Serangoon", "Lorong Chuan", "Bishan", "Marymount", "Caldecott",
      "Botanic Gardens", "Farrer Road", "Holland Village", "Buona Vista",
      "one-north", "Kent Ridge", "Haw Par Villa", "Pasir Panjang", "Labrador Park",
      "Telok Blangah", "HarbourFront", "Bayfront", "Marina Bay",
    ],
  },
  {
    id: "sg-dtl",
    name: "Downtown Line",
    color: "#005EC4",
    stations: [
      "Bukit Panjang", "Cashew", "Hillview", "Hume", "Beauty World",
      "King Albert Park", "Sixth Avenue", "Tan Kah Kee", "Botanic Gardens",
      "Stevens", "Newton", "Little India", "Rochor", "Bugis", "Promenade",
      "Bayfront", "Downtown", "Telok Ayer", "Chinatown", "Fort Canning",
      "Bencoolen", "Jalan Besar", "Bendemeer", "Geylang Bahru", "Mattar",
      "MacPherson", "Ubi", "Kaki Bukit", "Bedok North", "Bedok Reservoir",
      "Tampines West", "Tampines", "Tampines East", "Upper Changi", "Expo",
      "Xilin", "Sungei Bedok",
    ],
  },
  {
    id: "sg-tel",
    name: "Thomson–East Coast Line",
    color: "#9D5B25",
    stations: [
      "Woodlands North", "Woodlands", "Woodlands South", "Springleaf", "Lentor",
      "Mayflower", "Bright Hill", "Upper Thomson", "Caldecott", "Stevens",
      "Napier", "Orchard Boulevard", "Orchard", "Great World", "Havelock",
      "Outram Park", "Maxwell", "Shenton Way", "Marina Bay", "Gardens by the Bay",
      "Tanjong Rhu", "Katong Park", "Tanjong Katong", "Marine Parade",
      "Marine Terrace", "Siglap", "Bayshore",
    ],
  },
];

export const singaporeMrtLines = buildLines(singaporeLineDefs);

// ---------------------------------------------------------------------------
// Bangkok BTS / MRT / ARL — all open stations.
// ---------------------------------------------------------------------------
const thailandLineDefs: LineDef[] = [
  {
    id: "th-bts-sukhumvit",
    name: "BTS Sukhumvit Line",
    color: "#8CC63F",
    stations: [
      "Khu Khot", "Yaek Kor Por Aor", "Royal Thai Air Force Museum",
      "Bhumibol Adulyadej Hospital", "Saphan Mai", "Sai Yud", "Phahon Yothin 59",
      "Wat Phra Sri Mahathat", "11th Infantry Regiment", "Bang Bua",
      "Royal Forest Department", "Kasetsart University", "Sena Nikhom",
      "Ratchayothin", "Phahon Yothin 24", "Ha Yaek Lat Phrao", "Mo Chit",
      "Saphan Khwai", "Ari", "Sanam Pao", "Victory Monument",
      "Phaya Thai", "Ratchathewi", "Siam", "Chit Lom", "Phloen Chit", "Nana",
      "Asok", "Phrom Phong", "Thong Lo", "Ekkamai", "Phra Khanong", "On Nut",
      "Bang Chak", "Punnawithi", "Udom Suk", "Bang Na", "Bearing", "Samrong",
      "Pu Chao", "Chang Erawan", "Royal Thai Naval Academy", "Pak Nam",
      "Srinagarindra", "Phraek Sa", "Sai Luat", "Kheha",
    ],
  },
  {
    id: "th-bts-silom",
    name: "BTS Silom Line",
    color: "#006F3B",
    stations: [
      "National Stadium", "Siam", "Ratchadamri", "Sala Daeng", "Chong Nonsi",
      "Saint Louis", "Surasak", "Saphan Taksin", "Krung Thon Buri",
      "Wongwian Yai", "Pho Nimit", "Talat Phlu", "Wutthakat", "Bang Wa",
    ],
  },
  {
    id: "th-mrt-blue",
    name: "MRT Blue Line",
    color: "#1E3E8F",
    stations: [
      "Tha Phra", "Charan 13", "Fai Chai", "Bang Khun Non", "Bang Yi Khan",
      "Sirindhorn", "Bang Phlat", "Bang O", "Bang Pho", "Tao Poon", "Bang Sue",
      "Kamphaeng Phet", "Chatuchak Park", "Phahon Yothin", "Lat Phrao",
      "Ratchadaphisek", "Sutthisan", "Huai Khwang", "Thailand Cultural Centre",
      "Phra Ram 9", "Phetchaburi", "Sukhumvit",
      "Queen Sirikit National Convention Centre", "Khlong Toei", "Lumphini",
      "Si Lom", "Sam Yan", "Hua Lamphong", "Wat Mangkon", "Sam Yot", "Sanam Chai",
      "Itsaraphap", "Bang Phai", "Bang Wa", "Phetkasem 48", "Phasi Charoen",
      "Bang Khae", "Lak Song",
    ],
  },
  {
    id: "th-mrt-purple",
    name: "MRT Purple Line",
    color: "#7C1F7F",
    stations: [
      "Khlong Bang Phai", "Talad Bang Yai", "Sam Yaek Bang Yai", "Bang Phlu",
      "Bang Rak Yai", "Bang Rak Noi Tha It", "Sai Ma", "Phra Nang Klao Bridge",
      "Yaek Nonthaburi 1", "Bang Krasor", "Nonthaburi Civic Center",
      "Ministry of Public Health", "Yaek Tiwanon", "Wong Sawang", "Bang Son",
      "Tao Poon",
    ],
  },
  {
    id: "th-arl",
    name: "Airport Rail Link",
    color: "#D6001C",
    stations: [
      "Phaya Thai", "Ratchaprarop", "Makkasan", "Ramkhamhaeng", "Hua Mak",
      "Ban Thap Chang", "Lat Krabang", "Suvarnabhumi",
    ],
  },
];

export const thailandTransitLines = buildLines(thailandLineDefs);

// ---------------------------------------------------------------------------
// China HSR — major stops on the main corridors.
// ---------------------------------------------------------------------------
const chinaLineDefs: LineDef[] = [
  {
    id: "cn-jinghu",
    name: "Beijing–Shanghai HSR",
    color: "#E60012",
    stations: ["Beijing South", "Jinan West", "Nanjing South", "Shanghai Hongqiao"],
  },
  {
    id: "cn-jingguang",
    name: "Beijing–Guangzhou HSR",
    color: "#0068B7",
    stations: [
      "Beijing West", "Zhengzhou East", "Wuhan", "Changsha South", "Guangzhou South",
    ],
  },
  {
    id: "cn-hukun",
    name: "Shanghai–Kunming HSR",
    color: "#00A040",
    stations: [
      "Shanghai Hongqiao", "Shanghai Songjiang", "Jiaxing South", "Hangzhou East",
      "Changsha South", "Kunming South",
    ],
  },
  {
    id: "cn-zhengxi",
    name: "Zhengzhou–Xi'an HSR",
    color: "#F39800",
    stations: ["Zhengzhou East", "Xi'an North"],
  },
  {
    id: "cn-guangshengang",
    name: "Guangzhou–Shenzhen–Hong Kong HSR",
    color: "#8A6BBE",
    stations: ["Guangzhou South", "Shenzhen North"],
  },
  {
    id: "cn-chengyu",
    name: "Chengdu–Chongqing HSR",
    color: "#E4007F",
    stations: ["Chengdu East", "Chongqing North"],
  },
];

export const chinaRailLines = buildLines(chinaLineDefs);

// ---------------------------------------------------------------------------
// Germany ICE — major corridors (DB).
// ---------------------------------------------------------------------------
const germanyLineDefs: LineDef[] = [
  {
    id: "de-berlin-munich",
    name: "ICE Berlin–München",
    color: "#EC0016",
    stations: ["Berlin Hbf", "Leipzig Hbf", "Nuremberg Hbf", "Munich Hbf"],
  },
  {
    id: "de-hamburg-munich",
    name: "ICE Hamburg–München",
    color: "#00A6EB",
    stations: [
      "Hamburg Hbf", "Hanover Hbf", "Frankfurt Hbf", "Mannheim Hbf",
      "Stuttgart Hbf", "Munich Hbf",
    ],
  },
  {
    id: "de-rhine-ruhr",
    name: "ICE Berlin–Rhein/Ruhr",
    color: "#63A615",
    stations: [
      "Berlin Hbf", "Wolfsburg Hbf", "Hanover Hbf", "Dortmund Hbf", "Essen Hbf",
      "Cologne Hbf",
    ],
  },
  {
    id: "de-koln-freiburg",
    name: "ICE Köln–Freiburg",
    color: "#EC6608",
    stations: ["Cologne Hbf", "Frankfurt Hbf", "Mannheim Hbf", "Freiburg Hbf"],
  },
  {
    id: "de-bremen-dresden",
    name: "ICE Bremen–Dresden",
    color: "#814997",
    stations: ["Bremen Hbf", "Hanover Hbf", "Leipzig Hbf", "Dresden Hbf"],
  },
  {
    id: "de-berlin-hamburg",
    name: "ICE Berlin–Hamburg",
    color: "#F39200",
    stations: ["Berlin Hbf", "Büchen", "Hamburg Hbf"],
  },
];

export const germanyRailLines = buildLines(germanyLineDefs);

// ---------------------------------------------------------------------------
// France TGV — major LGV corridors (SNCF).
// ---------------------------------------------------------------------------
const franceLineDefs: LineDef[] = [
  {
    id: "fr-sud-est",
    name: "LGV Sud-Est / Méditerranée",
    color: "#A0006E",
    stations: [
      "Paris Gare de Lyon", "Le Creusot TGV", "Mâcon-Loché TGV", "Lyon Perrache",
      "Lyon Part-Dieu", "Avignon TGV", "Marseille St-Charles", "Nice",
    ],
  },
  {
    id: "fr-nord",
    name: "LGV Nord",
    color: "#0064B0",
    stations: ["Paris Gare du Nord", "Arras", "Lille Flandres", "Lille Europe"],
  },
  {
    id: "fr-est",
    name: "LGV Est",
    color: "#E2001A",
    stations: ["Paris Gare de l'Est", "Strasbourg"],
  },
  {
    id: "fr-atlantique",
    name: "LGV Atlantique",
    color: "#009640",
    stations: ["Rennes", "Nantes", "Bordeaux St-Jean", "Toulouse Matabiau"],
  },
];

export const franceRailLines = buildLines(franceLineDefs);

// ---------------------------------------------------------------------------
// Switzerland intercity rail — major SBB corridors.
// ---------------------------------------------------------------------------
const switzerlandLineDefs: LineDef[] = [
  {
    id: "ch-ic1",
    name: "IC1 Genève-Aéroport–St. Gallen",
    color: "#D52B1E",
    stations: [
      "Genève-Aéroport", "Genève", "Lausanne", "Fribourg/Freiburg", "Bern",
      "Zürich HB", "Winterthur", "St. Gallen",
    ],
  },
  {
    id: "ch-ic2",
    name: "IC2 Zürich HB–Lugano",
    color: "#444B54",
    stations: [
      "Zürich HB", "Zug", "Arth-Goldau", "Bellinzona", "Lugano",
    ],
  },
  {
    id: "ch-ic3",
    name: "IC3 Basel SBB–Chur",
    color: "#8C1D40",
    stations: [
      "Basel SBB", "Zürich HB", "Zürich Flughafen", "Sargans", "Chur",
    ],
  },
  {
    id: "ch-ic5",
    name: "IC5 Genève-Aéroport–St. Gallen via Biel/Bienne",
    color: "#F5B700",
    stations: [
      "Genève-Aéroport", "Genève", "Lausanne", "Yverdon-les-Bains", "Biel/Bienne",
      "Zürich HB", "Winterthur", "St. Gallen",
    ],
  },
  {
    id: "ch-ir90",
    name: "IR90 Brig–Genève-Aéroport",
    color: "#1D6FA3",
    stations: [
      "Brig", "Sion", "Montreux", "Lausanne", "Genève", "Genève-Aéroport",
    ],
  },
];

export const switzerlandRailLines = buildLines(switzerlandLineDefs);
