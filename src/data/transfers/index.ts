export interface TransferInfo {
  stationId: string;
  stationName: string;
  country: string;
  description?: string;
  recommendedExit?: string;
  guidanceZh?: string;
  guidanceEn?: string;
  sources?: { label: string; url: string }[];
  transferLines: {
    category: string; // e.g. "High Speed Rail", "Metro", "Bus", "Airport"
    lines: {
      name: string;
      notes?: string;
      color?: string;
    }[];
  }[];
}

export const transferCatalog: Record<string, TransferInfo> = {
  // 1. Switzerland (瑞士)
  "switzerland_geneve": {
    stationId: "switzerland_geneve",
    stationName: "Genève",
    country: "Switzerland",
    recommendedExit: "Place de Cornavin (Pl. 3/4)",
    guidanceZh: "轉乘 Léman Express 可前往法國邊境城鎮；出站即為路面電車站，搭乘 Tram 15 可直達聯合國歐洲總部。",
    guidanceEn: "Transfer to Léman Express for French border; Take Tram 15 outside directly to UN HQ.",
    transferLines: [
      {
        category: "Léman Express (S-Bahn)",
        lines: [
          { name: "L1 Line", color: "#E30613" },
          { name: "L2 Line", color: "#009640" },
          { name: "L3 Line", color: "#0047BA" },
          { name: "L4 Line", color: "#F29400" }
        ]
      },
      {
        category: "Trams & Buses",
        lines: [
          { name: "Tram 15 (Towards Nations / UN HQ)", color: "#FF5F00" },
          { name: "Local Bus Network (tpg)", color: "#7F7F7F" }
        ]
      },
      {
        category: "National & Regional Rail",
        lines: [
          { name: "SBB InterCity (IC1, IC5)", color: "#FF0000" },
          { name: "Cross-border Coach Terminal", color: "#4B5563" }
        ]
      }
    ]
  },
  "switzerland_lausanne": {
    stationId: "switzerland_lausanne",
    stationName: "Lausanne",
    country: "Switzerland",
    recommendedExit: "Place de la Gare (Pl. 5)",
    guidanceZh: "洛桑地鐵 M2 是瑞士唯一的地下鐵，搭乘 M2 往南至終點站 Ouchy-Olympique 碼頭，可轉乘 CGN 渡輪橫跨日內瓦湖前往法國 Evian。",
    guidanceEn: "Lausanne M2 is Switzerland's only metro. Ride M2 south to Ouchy for CGN ferries to France.",
    transferLines: [
      {
        category: "Metro",
        lines: [
          { name: "Lausanne Metro M2 Line", notes: "Connects to lakefront & city center", color: "#E30613" }
        ]
      },
      {
        category: "Lake Ferries & Buses",
        lines: [
          { name: "CGN Lake Geneva Ferries", notes: "Available at Ouchy-Olympique harbor", color: "#0090D2" },
          { name: "Regional Bus Line 1", color: "#009640" },
          { name: "Regional Bus Line 2", color: "#0047BA" }
        ]
      }
    ]
  },
  "switzerland_bern": {
    stationId: "switzerland_bern",
    stationName: "Bern",
    country: "Switzerland",
    recommendedExit: "Bahnhofplatz (City Exit) (Pl. 11)",
    guidanceZh: "伯恩為瑞士首都，出站後可直接轉乘路面電車 9 號線前往聯邦宮。郵政巴士總站提供前往阿爾卑斯山區的接駁。",
    guidanceEn: "Bern S-Bahn & Trams available. PostBus terminal offers routes into Alpine valleys.",
    transferLines: [
      {
        category: "S-Bahn",
        lines: [
          { name: "Bern S-Bahn (S1, S2, S3, S4, S5)", color: "#009640" }
        ]
      },
      {
        category: "Bern Trams (BERNMOBIL)",
        lines: [
          { name: "Tram 6", color: "#E30613" },
          { name: "Tram 7", color: "#FF5F00" },
          { name: "Tram 8", color: "#0047BA" },
          { name: "Tram 9 (To Federal Palace)", color: "#F29400" }
        ]
      },
      {
        category: "PostBus",
        lines: [
          { name: "PostBus Terminal", notes: "Regional routes to mountain areas", color: "#FFD400" }
        ]
      }
    ]
  },
  "switzerland_zurich": {
    stationId: "switzerland_zurich",
    stationName: "Zürich HB",
    country: "Switzerland",
    recommendedExit: "Bahnhofstrasse (Pl. 31-34 地底月台)",
    guidanceZh: "瑞士最大樞紐。地下月台（如 31-34 號月台）可無縫轉乘遍佈全蘇黎世州的 S-Bahn。出站即為班霍夫大街，並可轉乘路面電車 4 號線或利馬特河船。",
    guidanceEn: "Largest Swiss hub. Seamless transfer to S-Bahn. Connect to Trams & Limmat river boats.",
    transferLines: [
      {
        category: "S-Bahn",
        lines: [
          { name: "Zürich S-Bahn Network (All Lines)", color: "#005EB8" }
        ]
      },
      {
        category: "City Trams",
        lines: [
          { name: "Tram 3", color: "#E30613" },
          { name: "Tram 4 (To Riverfront / Lake)", color: "#009640" },
          { name: "Tram 11", color: "#0047BA" },
          { name: "Tram 14", color: "#F29400" }
        ]
      },
      {
        category: "Water Transit & Special Rail",
        lines: [
          { name: "Limmat River Boat (Limmatschiff)", notes: "Seasonal river sightseeing", color: "#0090D2" },
          { name: "SZU Uetliberg Railway", notes: "Mountain excursion railway", color: "#7F7F7F" }
        ]
      }
    ]
  },

  // 2. Germany (德國)
  "germany_berlin": {
    stationId: "germany_berlin",
    stationName: "Berlin Hbf",
    country: "Germany",
    recommendedExit: "Europaplatz / Washingtonplatz (Pl. 12/高架上層)",
    guidanceZh: "立體化車站。高架上層（11-16月台）為東西向 S-Bahn 與長途車，地底深層則為南北向 U5 與長途車。出站即有 Tram M10 可前往東柏林。",
    guidanceEn: "Multi-level station. S-Bahn on upper tracks; U5 on deep underground tracks. Tram M10 connects to East Berlin.",
    transferLines: [
      {
        category: "S-Bahn (Upper Level)",
        lines: [
          { name: "S3", color: "#1D5E9B" },
          { name: "S5", color: "#EF7C00" },
          { name: "S7", color: "#7A62A3" },
          { name: "S9 (Direct to BER Airport)", color: "#8E2B2B" }
        ]
      },
      {
        category: "U-Bahn (Deep Level)",
        lines: [
          { name: "U5", color: "#865D3B" }
        ]
      },
      {
        category: "Trams & Regional Express",
        lines: [
          { name: "Tram M10 (To East Berlin / Prenzlauer Berg)", color: "#E30613" },
          { name: "Tram M5 / M8", color: "#E30613" },
          { name: "RE1 / RE2 Regional Express", color: "#FF0000" }
        ]
      }
    ]
  },
  "germany_leipzig": {
    stationId: "germany_leipzig",
    stationName: "Leipzig Hbf",
    country: "Germany",
    recommendedExit: "Willy-Brandt-Platz (Pl. 10)",
    guidanceZh: "歐洲月台面最寬的車站。地下設有「城市隧道 (City-Tunnel)」，可直接轉乘 S-Bahn 貫穿萊比錫市中心。",
    guidanceEn: "Europe's widest station. Transfer to Mitteldeutschland S-Bahn via the underground City Tunnel.",
    transferLines: [
      {
        category: "S-Bahn (City-Tunnel)",
        lines: [
          { name: "S-Bahn Mitteldeutschland (S1 - S6)", color: "#009640" }
        ]
      },
      {
        category: "City Trams (LVB)",
        lines: [
          { name: "Tram 1", color: "#E30613" },
          { name: "Tram 3", color: "#0047BA" },
          { name: "Tram 8", color: "#F29400" }
        ]
      }
    ]
  },
  "germany_nuremberg": {
    stationId: "germany_nuremberg",
    stationName: "Nürnberg Hbf",
    country: "Germany",
    recommendedExit: "Königstor (Old Town) (Pl. 8)",
    guidanceZh: "轉乘地鐵 U2 線（全自動無人駕駛）可直達紐倫堡機場。出站通過國王門（Königstor）地下道即達老城區入口。",
    guidanceEn: "Nuremberg U2/U3 are fully automated; U2 connects directly to Nuremberg Airport.",
    transferLines: [
      {
        category: "U-Bahn",
        lines: [
          { name: "U1 Line", color: "#005EB8" },
          { name: "U2 Line (To Airport / Fully Automated)", color: "#E30613" },
          { name: "U3 Line (Fully Automated)", color: "#009640" }
        ]
      },
      {
        category: "S-Bahn & Regional",
        lines: [
          { name: "Nuremberg S-Bahn (S1 - S6)", color: "#7F7F7F" },
          { name: "RE Regional Express", color: "#FF0000" }
        ]
      }
    ]
  },
  "germany_munich": {
    stationId: "germany_munich",
    stationName: "München Hbf",
    country: "Germany",
    recommendedExit: "Arnulfstraße / Bayerstraße (Pl. 22)",
    guidanceZh: "轉乘 S-Bahn (S1 或 S8) 可直達慕尼黑機場；亦可在此轉乘原 BOB（現為 BRB）地方鐵路前往阿爾卑斯山麓的泰根湖（Tegernsee）。",
    guidanceEn: "S1/S8 provide direct airport access. BRB train connects to Bavarian Alps and lakes.",
    transferLines: [
      {
        category: "S-Bahn (Trunk Line / Stammstrecke)",
        lines: [
          { name: "S1 (To Munich Airport)", color: "#009640" },
          { name: "S8 (To Munich Airport)", color: "#FF5F00" },
          { name: "S2, S3, S4, S6, S7 Lines", color: "#7F7F7F" }
        ]
      },
      {
        category: "U-Bahn",
        lines: [
          { name: "U1 / U2", color: "#0047BA" },
          { name: "U4 / U5", color: "#E30613" }
        ]
      },
      {
        category: "Regional Rail & Trams",
        lines: [
          { name: "BRB (Bayerische Regiobahn to Tegernsee)", color: "#722F37" },
          { name: "Tram 19", color: "#FF0000" }
        ]
      }
    ]
  },

  // 3. Japan (日本)
  "japan_ikebukuro": {
    stationId: "japan_ikebukuro",
    stationName: "Ikebukuro",
    country: "Japan",
    recommendedExit: "東口 / 西口 (M-25)",
    guidanceZh: "三大地鐵線與兩大私鐵（西武、東武）的超級交匯點。西武鐵道可前往秩父，東武東上線可前往川越。",
    guidanceEn: "Major hub. West exits link to Tobu Tojo Line (to Kawagoe); East exits link to Seibu Ikebukuro Line.",
    transferLines: [
      {
        category: "Tokyo Metro",
        lines: [
          { name: "Marunouchi Line", color: "#f62e36" },
          { name: "Yurakucho Line", color: "#c1a470" },
          { name: "Fukutoshin Line", color: "#9c5e31" }
        ]
      },
      {
        category: "JR East Lines",
        lines: [
          { name: "Yamanote Line", color: "#80c241" },
          { name: "Saikyo Line", color: "#00b48d" },
          { name: "Shonan-Shinjuku Line", color: "#e21f26" }
        ]
      },
      {
        category: "Private Railways",
        lines: [
          { name: "Seibu Ikebukuro Line", notes: "To Chichibu", color: "#0067b0" },
          { name: "Tobu Tojo Line", notes: "To Kawagoe", color: "#002a62" }
        ]
      }
    ]
  },
  "japan_otemachi": {
    stationId: "japan_otemachi",
    stationName: "Otemachi",
    country: "Japan",
    recommendedExit: "C10 / B1 出口 (M-18)",
    guidanceZh: "東京最大的地鐵轉乘站，五線交匯。經由地下聯絡通道可直接步行至 JR 東京站轉乘新幹線，免受日曬雨淋。",
    guidanceEn: "Tokyo's largest metro hub. 5-line connection. Underground passage connects to JR Tokyo Station.",
    transferLines: [
      {
        category: "Tokyo Metro",
        lines: [
          { name: "Tozai Line", color: "#009bbf" },
          { name: "Chiyoda Line", color: "#00bb85" },
          { name: "Hanzomon Line", color: "#8f76d6" },
          { name: "Marunouchi Line", color: "#f62e36" }
        ]
      },
      {
        category: "Toei Subway",
        lines: [
          { name: "Mita Line", color: "#0079c2" }
        ]
      },
      {
        category: "JR Connection",
        lines: [
          { name: "JR Tokyo Station (Underground Walkway)", notes: "Underground pedestrian connection" }
        ]
      }
    ]
  },
  "japan_tokyo": {
    stationId: "japan_tokyo",
    stationName: "Tokyo",
    country: "Japan",
    recommendedExit: "丸之內中央口 / 八重洲口 (M-17)",
    guidanceZh: "日本鐵路網的核心。地鐵丸之內線出站可直達丸之內地下中央口，轉乘新幹線或直達迪士尼的京葉線。",
    guidanceEn: "Heart of Japan's rail. Marunouchi Line links directly to Shinkansen gates and Narita Express (NEX).",
    transferLines: [
      {
        category: "Shinkansen (High Speed Rail)",
        lines: [
          { name: "Tokaido / Sanyo Shinkansen", color: "#0073bf" },
          { name: "Tohoku / Hokkaido Shinkansen", color: "#008000" },
          { name: "Joetsu / Hokuriku Shinkansen", color: "#008000" }
        ]
      },
      {
        category: "JR East Lines",
        lines: [
          { name: "Yamanote Line", color: "#80c241" },
          { name: "Chuo Line", color: "#f15a22" },
          { name: "Keihin-Tohoku Line", color: "#00b2e5" },
          { name: "Tokaido Main Line", color: "#f15a22" },
          { name: "Keiyo Line (Direct to Tokyo Disneyland)", color: "#c9242b" },
          { name: "Yokosuka / Sobu Line & Narita Express", color: "#0074bf" }
        ]
      },
      {
        category: "Subway / Metro",
        lines: [
          { name: "Tokyo Metro Marunouchi Line", color: "#f62e36" }
        ]
      }
    ]
  },
  "japan_shinjuku": {
    stationId: "japan_shinjuku",
    stationName: "Shinjuku",
    country: "Japan",
    recommendedExit: "南口 / BUSTA新宿 (M-08)",
    guidanceZh: "世界乘降客數第一。轉乘小田急浪漫特快可前往箱根；南口上方即為 BUSTA 新宿，可轉乘前往日本各地的長途高速巴士。",
    guidanceEn: "Busiest in the world. Transfer to Odakyu Romancecar for Hakone; BUSTA terminal upstairs for highway buses.",
    transferLines: [
      {
        category: "JR East Lines",
        lines: [
          { name: "Yamanote Line", color: "#80c241" },
          { name: "Chuo Line (Rapid)", color: "#f15a22" },
          { name: "Chuo-Sobu Line", color: "#ffd400" },
          { name: "Saikyo Line", color: "#00b48d" },
          { name: "Shonan-Shinjuku Line", color: "#e21f26" }
        ]
      },
      {
        category: "Subway / Metro",
        lines: [
          { name: "Tokyo Metro Marunouchi Line", color: "#f62e36" },
          { name: "Toei Shinjuku Line", color: "#b0bf1e" },
          { name: "Toei Oedo Line", color: "#e85298" }
        ]
      },
      {
        category: "Private Railways & Bus",
        lines: [
          { name: "Odakyu Odawara Line (Romancecar to Hakone)", color: "#0067b0" },
          { name: "Keio Line / Keio New Line", color: "#dd0067" },
          { name: "Seibu Shinjuku Line", color: "#00a0e2" },
          { name: "BUSTA Shinjuku (Express Highway Bus Terminal)", color: "#4B5563" }
        ]
      }
    ]
  },

  // 4. South Korea (韓國)
  "korea_hongik": {
    stationId: "korea_hongik",
    stationName: "Hongik Univ.",
    country: "South Korea",
    recommendedExit: "Exit 4 (A'REX) / Exit 9 (Stn. 239)",
    guidanceZh: "青年文化中心。在此可由 2 號線轉乘 A'REX 機場鐵路直達仁川國際機場與金浦機場，設有市內預辦登機服務。",
    guidanceEn: "Youth cultural district. Transition to AREX for direct trains to Incheon & Gimpo Airports.",
    transferLines: [
      {
        category: "Seoul Subway & Rail",
        lines: [
          { name: "Seoul Subway Line 2", color: "#37b42c" },
          { name: "Gyeongui-Jungang Line", color: "#77c4a3" }
        ]
      },
      {
        category: "Airport Railroad",
        lines: [
          { name: "AREX (Airport Railroad)", notes: "Direct to Incheon / Gimpo", color: "#0090d2" }
        ]
      }
    ]
  },
  "korea_sinchon": {
    stationId: "korea_sinchon",
    stationName: "Sinchon",
    country: "South Korea",
    recommendedExit: "Exit 7 / Exit 8 (Stn. 240)",
    guidanceZh: "2 號線單一車站，無直接地鐵轉乘。但出站可在 7、8 號出口前的巴士站轉乘前往西大門區、麻浦區等主要大學城之公車。",
    guidanceEn: "No metro transfers, but heavy bus network at Exits 7 & 8 serving universities area.",
    transferLines: [
      {
        category: "Seoul Subway",
        lines: [
          { name: "Seoul Subway Line 2", color: "#37b42c" }
        ]
      },
      {
        category: "City Buses",
        lines: [
          { name: "Seoul Local Bus Network", notes: "Provides access to Yonsei, Sogang & Ewha universities" }
        ]
      }
    ]
  },
  "korea_cityhall": {
    stationId: "korea_cityhall",
    stationName: "City Hall",
    country: "South Korea",
    recommendedExit: "Exit 5 (City Hall Sq) (Stn. 201)",
    guidanceZh: "歷史與現代交會。可轉乘 1 號線前往首爾車站。出站為德壽宮，旁邊設有首爾市區雙層觀光巴士停靠站。",
    guidanceEn: "Transfer to Line 1. Exit 5 faces Seoul Plaza and Deoksugung Palace; City Tour Bus stops nearby.",
    transferLines: [
      {
        category: "Seoul Subway",
        lines: [
          { name: "Seoul Subway Line 1", color: "#0d3692" },
          { name: "Seoul Subway Line 2", color: "#37b42c" }
        ]
      },
      {
        category: "Sightseeing",
        lines: [
          { name: "Seoul Double-Decker City Tour Bus", notes: "Stops near Exit 5", color: "#FFD400" }
        ]
      }
    ]
  },
  "korea_gangnam": {
    stationId: "korea_gangnam",
    stationName: "Gangnam",
    country: "South Korea",
    recommendedExit: "Exit 2 / Exit 11 (Stn. 222)",
    guidanceZh: "商業重鎮。轉乘新盆唐線可快速前往板橋科技谷；江南大路中央設有公車專用道，可轉乘大量前往水原、盆唐等衛星城市的廣域紅色公車。",
    guidanceEn: "Transfer to Shinbundang Line. Central bus lanes offer express red buses to Gyeonggi Province.",
    transferLines: [
      {
        category: "Seoul Subway",
        lines: [
          { name: "Seoul Subway Line 2", color: "#37b42c" },
          { name: "Shinbundang Line", notes: "Direct to Pangyo Techno Valley", color: "#d4003b" }
        ]
      },
      {
        category: "Express & Red Buses",
        lines: [
          { name: "Gyeonggi Province Express Red Buses", notes: "Central transit lanes", color: "#E30613" }
        ]
      }
    ]
  },
  "korea_seoul": {
    stationId: "korea_seoul",
    stationName: "Seoul",
    country: "South Korea",
    recommendedExit: "Exit 1 / Main Concourse",
    guidanceZh: "韓國主要鐵路車站，整合高鐵 KTX 與多條地鐵、機場快線，提供極其便利的全國與國際接駁。",
    guidanceEn: "Major railway station in South Korea, integrating KTX high-speed rail with metro and airport links.",
    transferLines: [
      {
        category: "High Speed & Intercity",
        lines: [
          { name: "KTX", color: "#00487F" },
          { name: "ITX-Saemaeul", color: "#E11A22" },
          { name: "Mugunghwa-ho", color: "#E11A22" }
        ]
      },
      {
        category: "Seoul Subway",
        lines: [
          { name: "Seoul Subway Line 1", color: "#0d3692" },
          { name: "Seoul Subway Line 4", color: "#00a84d" },
          { name: "Gyeongui-Jungang Line", color: "#77c4a3" }
        ]
      },
      {
        category: "Airport Railroad",
        lines: [
          { name: "AREX (Airport Railroad)", notes: "Direct train to Incheon / Gimpo Airports", color: "#0090D2" }
        ]
      }
    ]
  },
  "korea_busan": {
    stationId: "korea_busan",
    stationName: "Busan",
    country: "South Korea",
    recommendedExit: "Exit 1 / Main Concourse",
    guidanceZh: "釜山最大高速鐵路樞紐，轉乘地鐵 1 號線可輕鬆前往市區主要觀光景點。",
    guidanceEn: "Busan's primary high-speed rail hub, with direct connection to Busan Metro Line 1 for downtown sightseeing.",
    transferLines: [
      {
        category: "High Speed & Intercity",
        lines: [
          { name: "KTX", color: "#00487F" },
          { name: "SRT", color: "#54203B" }
        ]
      },
      {
        category: "Metro",
        lines: [
          { name: "Busan Metro Line 1", color: "#F06A00" }
        ]
      }
    ]
  },

  // 5. Singapore (新加坡)
  "singapore_changi": {
    stationId: "singapore_changi",
    stationName: "Changi Airport",
    country: "Singapore",
    recommendedExit: "T2 / T3 Pedestrian Link (CG2)",
    guidanceZh: "位於 T2 與 T3 之間。出站可搭乘免費的 Skytrain 前往各航廈及星耀樟宜 (Jewel)；地下巴士站設有 36 號巴士直達市區烏節路。",
    guidanceEn: "Located between T2/T3. Free Skytrain connects all terminals & Jewel. Bus 36 at basement to Orchard.",
    transferLines: [
      {
        category: "Airport Shuttles",
        lines: [
          { name: "Changi Airport Skytrain", notes: "Free terminal connections", color: "#7F7F7F" }
        ]
      },
      {
        category: "MRT & Buses",
        lines: [
          { name: "MRT East West Line (Airport Branch)", color: "#009645" },
          { name: "Bus 36 (Basement Bay to Orchard Rd)", color: "#1D3A8A" }
        ]
      }
    ]
  },
  "singapore_tanah": {
    stationId: "singapore_tanah",
    stationName: "Tanah Merah",
    country: "Singapore",
    recommendedExit: "Exit A / Exit B (EW4)",
    guidanceZh: "機場支線的終點站。採用「雙側開門」設計，中線列車兩側車門皆會開啟，乘客可直接跨月台轉乘東西線主線，免換樓層。",
    guidanceEn: "Interchange for Airport branch. Trains open both doors; cross-platform transfer to EW Line.",
    transferLines: [
      {
        category: "MRT",
        lines: [
          { name: "MRT East West Line (Main Line to Pasir Ris / Tuas Link)", color: "#009645" }
        ]
      }
    ]
  },
  "singapore_paya": {
    stationId: "singapore_paya",
    stationName: "Paya Lebar",
    country: "Singapore",
    recommendedExit: "Exit A (PLQ Mall) (EW8 / CC9)",
    guidanceZh: "高架與地下交會站。東西線（高架）與環線（地下）在此交會。出站後可轉乘公車前往加東、馬林百列等充滿土生華人風情的地區。",
    guidanceEn: "Elevated-to-underground transfer. Green Line links to Circle (Yellow) Line. Bus connections to Katong.",
    transferLines: [
      {
        category: "MRT",
        lines: [
          { name: "MRT East West Line (Green)", color: "#009645" },
          { name: "MRT Circle Line (Yellow)", color: "#F9D11C" }
        ]
      },
      {
        category: "City Buses",
        lines: [
          { name: "Buses to Katong & Marine Parade Historical Areas", color: "#7F7F7F" }
        ]
      }
    ]
  },
  "singapore_cityhall": {
    stationId: "singapore_cityhall",
    stationName: "City Hall",
    country: "Singapore",
    recommendedExit: "Exit B (St. Andrew's) (EW13 / NS25)",
    guidanceZh: "極致的跨月台設計。與南北線平行。往西向與往北向的列車停靠在同一層，反向在另一層，實現「對面即可轉乘」的便利。",
    guidanceEn: "Seamless cross-platform transfer between Green and Red lines. Citylink Mall connects to Esplanade.",
    transferLines: [
      {
        category: "MRT",
        lines: [
          { name: "MRT East West Line (Green)", color: "#009645" },
          { name: "MRT North South Line (Red)", color: "#E22631" }
        ]
      },
      {
        category: "Underground Walkways",
        lines: [
          { name: "Citylink Mall (To Esplanade / Suntec)", notes: "Air-conditioned retail walkway" }
        ]
      }
    ]
  },

  // 6. Thailand (泰國)
  "thailand_mochit": {
    stationId: "thailand_mochit",
    stationName: "Mo Chit",
    country: "Thailand",
    recommendedExit: "Exit 3 (Park Connect) (N8)",
    guidanceZh: "空鐵與地鐵交會。出站經天橋可下至地面轉乘 MRT「恰圖恰公園站」；亦可在此搭乘 A1/A2 機場巴士前往廊曼機場 (DMK)。",
    guidanceEn: "BTS connects to MRT Blue Line (Chatuchak Park). Shuttle buses A1/A2 run to Don Mueang Airport.",
    transferLines: [
      {
        category: "MRT",
        lines: [
          { name: "MRT Blue Line (Chatuchak Park Station)", color: "#1D3A8A" }
        ]
      },
      {
        category: "Airport Buses & Terminals",
        lines: [
          { name: "Airport Bus A1 / A2 (To Don Mueang DMK Airport)", color: "#FF5F00" },
          { name: "Mo Chit 2 Northern Bus Terminal Shuttle Bus", notes: "Intercity bus link", color: "#7F7F7F" }
        ]
      }
    ]
  },
  "thailand_victory": {
    stationId: "thailand_victory",
    stationName: "Victory Monument",
    country: "Thailand",
    recommendedExit: "Skywalk Circle Interchange (N3)",
    guidanceZh: "曼谷最大的公車圓環。巨大的空中高架步道 (Skywalk) 連接圓環四周的巴士站，可轉乘前往曼谷市區各角落的公車。",
    guidanceEn: "Massive local bus hub. Elevated Skywalk circles the monument to guide passengers to correct bus bays.",
    transferLines: [
      {
        category: "City Buses",
        lines: [
          { name: "BMTA Local Bus Hub (Circular Network)", color: "#E30613" }
        ]
      },
      {
        category: "Minivans",
        lines: [
          { name: "Regional Minivans (To Outlying Provinces)", color: "#7F7F7F" }
        ]
      }
    ]
  },
  "thailand_phayathai": {
    stationId: "thailand_phayathai",
    stationName: "Phaya Thai",
    country: "Thailand",
    recommendedExit: "Exit 5 (ARL Link) (N2)",
    guidanceZh: "空鐵與機場快線的聯絡站。出站設有專用空中連廊直通 ARL 車站，可搭乘機場捷運直達蘇萬那普國際機場 (BKK)。",
    guidanceEn: "Direct sky-bridge connection to Airport Rail Link (ARL) to Suvarnabhumi Airport.",
    transferLines: [
      {
        category: "Airport Rail Link",
        lines: [
          { name: "Airport Rail Link (ARL)", notes: "Express to Suvarnabhumi BKK Airport", color: "#E11F26" }
        ]
      }
    ]
  },
  "thailand_siam": {
    stationId: "thailand_siam",
    stationName: "Siam",
    country: "Thailand",
    recommendedExit: "Exit 3 (Siam Paragon) (CEN)",
    guidanceZh: "BTS 的超級核心雙層車站。上層與下層皆提供跨月台轉乘，可無縫轉往席隆線前往沙吞碼頭（轉乘招披耶河觀光船）。",
    guidanceEn: "BTS Central Station. Dual-level cross-platform transfer to Silom Line for Sathorn Pier.",
    transferLines: [
      {
        category: "BTS Lines",
        lines: [
          { name: "BTS Sukhumvit Line (Light Green)", color: "#82C341" },
          { name: "BTS Silom Line (Dark Green)", color: "#006837" }
        ]
      },
      {
        category: "Skywalks",
        lines: [
          { name: "Siam Skywalk Network", notes: "Connects to CentralWorld, MBK, Siam Square" }
        ]
      }
    ]
  },

  // 7. Hong Kong (香港)
  "hongkong_mongkok": {
    stationId: "hongkong_mongkok",
    stationName: "Mong Kok",
    country: "Hong Kong",
    recommendedExit: "Exit B2 / 天橋至旺角東 (MOK)",
    guidanceZh: "荃灣綫與觀塘綫的跨月台轉乘站。出站後沿著旺角道行人天橋步行約 10 分鐘，可達旺角東站轉乘東鐵綫前往羅湖/落馬洲邊境。",
    guidanceEn: "Cross-platform to Kwun Tong Line. Pedestrian bridge connects to Mong Kok East for East Rail Line.",
    transferLines: [
      {
        category: "MTR Lines",
        lines: [
          { name: "Tsuen Wan Line (Red)", color: "#E2231A" },
          { name: "Kwun Tong Line (Green)", color: "#009543" },
          { name: "East Rail Line (At Mong Kok East Station)", notes: "Via 10-minute elevated Skywalk", color: "#5291CE" }
        ]
      }
    ]
  },
  "hongkong_admiralty": {
    stationId: "hongkong_admiralty",
    stationName: "Admiralty",
    country: "Hong Kong",
    recommendedExit: "Exit A (Admiralty Centre) (ADM)",
    guidanceZh: "四綫匯聚的超級轉乘大站。地底設有多層立體月台。荃灣綫與港島綫在此對面轉乘；往下可直達東鐵綫，直通深圳羅湖/落馬洲。",
    guidanceEn: "Mega 4-line hub. Cross-platform for Island/Tsuen Wan Line. Deep underground platforms link to East Rail Line.",
    transferLines: [
      {
        category: "MTR Lines",
        lines: [
          { name: "Tsuen Wan Line (Red)", color: "#E2231A" },
          { name: "Island Line (Blue)", color: "#007DC5" },
          { name: "South Island Line (Lime)", color: "#E0AF1B" },
          { name: "East Rail Line (Direct to border / Lo Wu)", color: "#5291CE" }
        ]
      }
    ]
  },
  "hongkong_central": {
    stationId: "hongkong_central",
    stationName: "Central",
    country: "Hong Kong",
    recommendedExit: "Exit A (Ferry Link) / Exit D (CEN / HOK)",
    guidanceZh: "中環站與香港站位於地底，由長大的人行通道（設有電動步道）連接，可在此轉乘機場快綫。Exit A 出站沿天橋可至碼頭搭天星小輪。",
    guidanceEn: "Underground passage connects to Hong Kong Station (Airport Express). Exit A leads to Star Ferry Piers.",
    transferLines: [
      {
        category: "MTR (Central / Hong Kong Station)",
        lines: [
          { name: "Island Line (Blue)", color: "#007DC5" },
          { name: "Tsuen Wan Line (Red)", color: "#E2231A" },
          { name: "Tung Chung Line (Orange)", color: "#F58220" },
          { name: "Airport Express (Direct to HKG Airport)", color: "#007078" }
        ]
      },
      {
        category: "Ferries",
        lines: [
          { name: "Star Ferry (Central Ferry Pier)", notes: "Exits to Tsim Sha Tsui", color: "#006837" }
        ]
      }
    ]
  },

  // 8. United Kingdom (英國)
  "uk_heathrow": {
    stationId: "uk_heathrow",
    stationName: "Heathrow Terminals 2 & 3",
    country: "United Kingdom",
    recommendedExit: "Central Terminal Area (Pl. 1)",
    guidanceZh: "出站通往客運航廈。在此可選擇便宜但站站停的皮卡迪利線，或選擇高規格的伊莉莎白線，或 15 分鐘直達帕丁頓的機場快線。",
    guidanceEn: "Airport hub. Choose between slower Piccadilly Line, high-spec Elizabeth Line, or rapid Heathrow Express.",
    transferLines: [
      {
        category: "Trains & Metro",
        lines: [
          { name: "Elizabeth Line", color: "#9B005B" },
          { name: "London Underground Piccadilly Line", color: "#003688" },
          { name: "Heathrow Express (15 min direct to Paddington)", color: "#532E63" }
        ]
      },
      {
        category: "Buses & Coaches",
        lines: [
          { name: "Central Bus Station (National Express)", notes: "Coaches to London and across UK", color: "#4B5563" }
        ]
      }
    ]
  },
  "uk_paddington": {
    stationId: "uk_paddington",
    stationName: "Paddington",
    country: "United Kingdom",
    recommendedExit: "Eastbourne Terrace Exit (Pl. 11/12 地底月台)",
    guidanceZh: "倫敦西部大門。伊莉莎白線在此設有寬敞的專屬地底月台（11與12號月台），出站可直接轉乘 GWR 火車前往溫莎、牛津或巴斯。",
    guidanceEn: "London West gateway. Elizabeth Line underground halls (Pl. 11/12) link to GWR National Rail trains for Windsor/Bath.",
    transferLines: [
      {
        category: "Underground Lines",
        lines: [
          { name: "Bakerloo Line", color: "#B36305" },
          { name: "Circle & District Lines", color: "#FFD300" },
          { name: "Hammersmith & City Line", color: "#F491A8" }
        ]
      },
      {
        category: "National Rail",
        lines: [
          { name: "GWR (Great Western Railway)", notes: "Intercity trains to West England / Wales", color: "#1D322F" }
        ]
      }
    ]
  },
  "uk_farringdon": {
    stationId: "uk_farringdon",
    stationName: "Farringdon",
    country: "United Kingdom",
    recommendedExit: "Cowcross Street (Pl. 2)",
    guidanceZh: "伊莉莎白線南北向與東西向的核心交叉點。在此可直接轉乘 Thameslink 鐵路直達蓋威克機場 (Gatwick) 或盧頓機場 (Luton)。",
    guidanceEn: "Crucial interchange. Directly link to Thameslink trains for Gatwick Airport and Luton Airport.",
    transferLines: [
      {
        category: "National Rail",
        lines: [
          { name: "Thameslink", notes: "Direct rail links to LGW / LTN Airports", color: "#FF3366" }
        ]
      },
      {
        category: "Underground Lines",
        lines: [
          { name: "Circle Line", color: "#FFD300" },
          { name: "Hammersmith & City Line", color: "#F491A8" },
          { name: "Metropolitan Line", color: "#9B005B" }
        ]
      }
    ]
  },

  // 9. United States (美國)
  "us_howard": {
    stationId: "us_howard",
    stationName: "Howard Beach-JFK",
    country: "United States",
    recommendedExit: "Coleman Square / AirTrain (A-Track)",
    guidanceZh: "地鐵 A 線與機場接駁軌道的交匯。乘客在此下車後，可直接轉乘 AirTrain 前往 JFK 機場的所有客運大樓（需使用 MetroCard 或 OMNY 刷卡進站）。",
    guidanceEn: "Interchange for JFK AirTrain. Exit metro and board airport people mover (AirTrain) to all terminals.",
    transferLines: [
      {
        category: "Airport AirTrain",
        lines: [
          { name: "JFK AirTrain (Howard Beach Route)", color: "#0090D2" }
        ]
      },
      {
        category: "Metro & Bus",
        lines: [
          { name: "NYC Subway A Line", color: "#003087" },
          { name: "Q11 Local Bus", color: "#7F7F7F" }
        ]
      }
    ]
  },
  "us_fulton": {
    stationId: "us_fulton",
    stationName: "Fulton Street",
    country: "United States",
    recommendedExit: "Fulton Center Atrium (Fulton Stn)",
    guidanceZh: "曼哈頓下城超大樞紐。Fulton Center 地下通道四通八達，可經由 Dey Street 通道前往世界貿易中心（WTC）轉乘 PATH 火車往新澤西。",
    guidanceEn: "Fulton Center hub. 9+ metro lines connect here. Underground walkway to WTC PATH station for NJ.",
    transferLines: [
      {
        category: "NYC Subway",
        lines: [
          { name: "Lines 2, 3", color: "#EE352E" },
          { name: "Lines 4, 5", color: "#00B259" },
          { name: "Lines A, C", color: "#003087" },
          { name: "Lines J, Z", color: "#996633" },
          { name: "Lines R, W", color: "#FCCC0A" }
        ]
      },
      {
        category: "PATH (To New Jersey)",
        lines: [
          { name: "PATH Train", notes: "Accessible at WTC via indoor Dey St corridor", color: "#0090D2" }
        ]
      }
    ]
  },
  "us_penn": {
    stationId: "us_penn",
    stationName: "Penn Station",
    country: "United States",
    recommendedExit: "Moynihan Train Hall (Track 4)",
    guidanceZh: "美國最繁忙鐵路樞紐。新落成的 Moynihan 候車大廳非常現代。在此可轉乘前往華盛頓、波士頓的 Acela 高鐵或往紐華克機場的火車。",
    guidanceEn: "Busiest US rail hub. Transfer to Amtrak Northeast Corridor (Acela) or NJ Transit for Newark Airport.",
    transferLines: [
      {
        category: "National & Commuter Rail",
        lines: [
          { name: "Amtrak (Acela Express / Northeast Corridor)", color: "#004B87" },
          { name: "LIRR (Long Island Rail Road)", color: "#0090D2" },
          { name: "NJ Transit (To Newark EWR Airport)", color: "#FF5F00" }
        ]
      },
      {
        category: "NYC Subway",
        lines: [
          { name: "Lines 1, 2, 3", color: "#EE352E" },
          { name: "Lines A, C, E", color: "#003087" }
        ]
      }
    ]
  },

  // 10. France (法國)
  "france_cdg": {
    stationId: "france_cdg",
    stationName: "CDG Airport T2",
    country: "France",
    recommendedExit: "Gare de l'Aéroport CDG 2 (Track 41)",
    guidanceZh: "航廈地下樞紐。在此可乘免費 CDGVAL 接駁至 T1/T3。火車站台層一側是 RER B（往市區），另一側即為 TGV 高鐵，可直達里昂或迪士尼。",
    guidanceEn: "Airport basement hub. Free CDGVAL shuttle to T1/T3. Direct TGV high-speed trains to Lyon/Marseille.",
    transferLines: [
      {
        category: "Trains",
        lines: [
          { name: "RER B (To Paris City Center)", color: "#5291CE" },
          { name: "SNCF TGV High-Speed Rail", notes: "Direct to Lyon, Marseille, Lille, Disneyland Paris", color: "#E7004B" }
        ]
      },
      {
        category: "Airport Shuttle & Bus",
        lines: [
          { name: "CDGVAL", notes: "Free automatic airport shuttle to T1 / T3", color: "#0090D2" },
          { name: "RATP Roissybus", notes: "Express to Opéra", color: "#7F7F7F" }
        ]
      }
    ]
  },
  "france_paris_nord": {
    stationId: "france_paris_nord",
    stationName: "Paris Gare du Nord",
    country: "France",
    recommendedExit: "Rue de Dunkerque (Track 43 / 地下)",
    guidanceZh: "歐洲客流量第一大站。地面層可搭乘歐洲之星（Eurostar）前往溫莎/倫敦，或搭 Eurostar 紅色車廂（原 Thalys）往布魯塞爾、阿姆斯特丹。地下層則可轉乘地鐵與 RER。",
    guidanceEn: "Europe's busiest station. Ground level hosts Eurostar to London/Brussels. Underground for Métro.",
    transferLines: [
      {
        category: "International & High Speed",
        lines: [
          { name: "Eurostar", notes: "High speed trains to London, Brussels, Amsterdam", color: "#E7004B" },
          { name: "TGV inOui", color: "#E7004B" }
        ]
      },
      {
        category: "RER & Metro",
        lines: [
          { name: "RER B", notes: "Direct to CDG Airport / Gare de Lyon", color: "#5291CE" },
          { name: "RER D", color: "#5E9620" },
          { name: "RER E", color: "#C1272D" },
          { name: "Métro 4 & 5", color: "#F68F4D" }
        ]
      }
    ]
  },

  // 11. Malaysia (馬來西亞) — verified against MyRapid interchange guidance.
  "malaysia_kl_sentral": {
    stationId: "malaysia_kl_sentral",
    stationName: "KL Sentral",
    country: "Malaysia",
    recommendedExit: "Follow MRT/LRT/Monorail interchange signage",
    guidanceZh: "KL Sentral 與 MRT Muzium Negara 之間設有轉乘通道；在 KL Sentral 站區可續轉 Kelana Jaya 線與 KL Monorail。請依車站指標及站務人員指示步行。",
    guidanceEn: "A pedestrian connection links KL Sentral with MRT Muzium Negara. Within the KL Sentral complex, follow station signage for the Kelana Jaya Line and KL Monorail.",
    transferLines: [
      { category: "Rapid KL rail", lines: [
        { name: "MRT Kajang Line (Muzium Negara)", color: "#0092D0" },
        { name: "LRT Kelana Jaya Line", color: "#E91E63" },
        { name: "KL Monorail", color: "#76BC21" },
      ] },
    ],
    sources: [{ label: "MyRapid interchange guidance", url: "https://myrapid.com.my/kelewatan-tren-laluan-kelana-jaya-3/" }],
  },
  "malaysia_pasar_seni": {
    stationId: "malaysia_pasar_seni",
    stationName: "Pasar Seni",
    country: "Malaysia",
    recommendedExit: "Follow MRT/LRT interchange signage",
    guidanceZh: "MRT Pasar Seni 與 LRT Pasar Seni（Kelana Jaya 線）可轉乘。此站繁忙時可能實施人流管制，請依現場指示通行。",
    guidanceEn: "MRT Pasar Seni connects with LRT Pasar Seni on the Kelana Jaya Line. Follow station signage; passenger-flow controls may operate during busy periods.",
    transferLines: [
      { category: "Rapid KL rail", lines: [
        { name: "MRT Kajang Line", color: "#0092D0" },
        { name: "LRT Kelana Jaya Line", color: "#E91E63" },
      ] },
    ],
    sources: [{ label: "MyRapid Kajang Line interchange guidance", url: "https://myrapid.com.my/info-semasa-laluan-kajang-3/" }],
  },
  "malaysia_merdeka": {
    stationId: "malaysia_merdeka",
    stationName: "Merdeka",
    country: "Malaysia",
    recommendedExit: "Follow signs to Plaza Rakyat",
    guidanceZh: "MRT Merdeka 可步行轉乘 Plaza Rakyat 的 Ampang／Sri Petaling 線；請依站內指標完成站外步行連接。",
    guidanceEn: "MRT Merdeka connects on foot to Plaza Rakyat for the Ampang and Sri Petaling Lines. Follow the signed pedestrian interchange route.",
    transferLines: [
      { category: "Rapid KL rail", lines: [
        { name: "MRT Kajang Line", color: "#0092D0" },
        { name: "LRT Ampang Line", color: "#F58220" },
        { name: "LRT Sri Petaling Line", color: "#7E57C2" },
      ] },
    ],
    sources: [{ label: "MyRapid Kajang Line interchange guidance", url: "https://myrapid.com.my/info-semasa-laluan-kajang-3/" }],
  },
  "malaysia_maluri": {
    stationId: "malaysia_maluri",
    stationName: "Maluri",
    country: "Malaysia",
    recommendedExit: "Follow MRT/LRT interchange signage",
    guidanceZh: "MRT Maluri 可轉乘 LRT Maluri 的 Ampang／Sri Petaling 線；請以現場指標為準。",
    guidanceEn: "MRT Maluri connects with LRT Maluri for the Ampang and Sri Petaling Lines. Follow interchange signage at the station.",
    transferLines: [
      { category: "Rapid KL rail", lines: [
        { name: "MRT Kajang Line", color: "#0092D0" },
        { name: "LRT Ampang Line", color: "#F58220" },
        { name: "LRT Sri Petaling Line", color: "#7E57C2" },
      ] },
    ],
    sources: [{ label: "MyRapid Kajang Line interchange guidance", url: "https://myrapid.com.my/info-semasa-laluan-kajang-3/" }],
  },
  "malaysia_tun_razak_exchange": {
    stationId: "malaysia_tun_razak_exchange",
    stationName: "Tun Razak Exchange",
    country: "Malaysia",
    recommendedExit: "Follow MRT line-transfer signage",
    guidanceZh: "TRX 是 MRT Kajang 線與 Putrajaya 線的換乘站；請依月台與站內指標轉乘，勿將此資料視為即時行車資訊。",
    guidanceEn: "TRX is the interchange between the MRT Kajang and Putrajaya Lines. Follow platform and station signage; this guidance is not real-time service information.",
    transferLines: [
      { category: "MRT", lines: [
        { name: "MRT Kajang Line", color: "#0092D0" },
        { name: "MRT Putrajaya Line", color: "#FFD100" },
      ] },
    ],
    sources: [{ label: "MyRapid Putrajaya Line interchange guidance", url: "https://myrapid.com.my/kemas-kini-laluan-putrajaya-putrajaya-line-update-2/" }],
  },
  "malaysia_bukit_bintang": {
    stationId: "malaysia_bukit_bintang",
    stationName: "Bukit Bintang",
    country: "Malaysia",
    recommendedExit: "Follow MRT/Monorail interchange signage",
    guidanceZh: "MRT Bukit Bintang 可轉乘 Bukit Bintang Monorail；此站繁忙時請預留步行與排隊時間，並依現場人流指示。",
    guidanceEn: "MRT Bukit Bintang connects with Bukit Bintang Monorail. Allow time for walking and queues during busy periods, and follow passenger-flow directions.",
    transferLines: [
      { category: "Rapid KL rail", lines: [
        { name: "MRT Kajang Line", color: "#0092D0" },
        { name: "KL Monorail", color: "#76BC21" },
      ] },
    ],
    sources: [{ label: "MyRapid Kajang Line interchange guidance", url: "https://myrapid.com.my/info-semasa-laluan-kajang-3/" }],
  },

  // 12. China (中國)
  "china_pudong": {
    stationId: "china_pudong",
    stationName: "Pudong Airport",
    country: "China",
    recommendedExit: "Terminal Hub Walkway (Maglev Bay)",
    guidanceZh: "位於 T1 與 T2 航廈的中間連廊。乘客在此可選擇時速 300 公里的磁浮列車直達市區，亦可選擇站站停的地鐵 2 號線直通虹橋樞紐。",
    guidanceEn: "Located between T1/T2. Choose between 300km/h Maglev to city center or Metro Line 2 to Hongqiao.",
    transferLines: [
      {
        category: "High Speed Maglev",
        lines: [
          { name: "Shanghai Maglev Line", notes: "300km/h to Longyang Road Station", color: "#00938C" }
        ]
      },
      {
        category: "Metro & Bus",
        lines: [
          { name: "Shanghai Metro Line 2", notes: "Direct to People's Square & Hongqiao", color: "#99CC33" },
          { name: "Pudong Airport Bus Lines 1-9", color: "#7F7F7F" },
          { name: "Terminal Shuttle Trains (To Satellite Terminals)", color: "#7F7F7F" }
        ]
      }
    ]
  },
  "china_longyang": {
    stationId: "china_longyang",
    stationName: "Longyang Road",
    country: "China",
    recommendedExit: "Exit 4 / Exit 6 (Platform 1)",
    guidanceZh: "五線交匯的超級巨無霸車站。磁懸浮的高架車站與地鐵的地下/高架車站通過連廊相接，轉乘 16 號線可前往臨港、滴水湖。",
    guidanceEn: "Massive 5-line hub. High-speed Maglev terminal connects to Subway Lines 2, 7, 16, and 18 via footbridges.",
    transferLines: [
      {
        category: "High Speed Maglev",
        lines: [
          { name: "Shanghai Maglev Line", notes: "Direct to Pudong International Airport", color: "#00938C" }
        ]
      },
      {
        category: "Shanghai Metro",
        lines: [
          { name: "Metro Line 2", color: "#99CC33" },
          { name: "Metro Line 7", color: "#E60012" },
          { name: "Metro Line 16", notes: "Express trains to Lingang & Dishui Lake", color: "#00A0E9" },
          { name: "Metro Line 18", color: "#C8A155" }
        ]
      },
      {
        category: "Bus",
        lines: [
          { name: "Longyang Road Bus Transit Hub", color: "#7F7F7F" }
        ]
      }
    ]
  }
};

const normalizeMatchKey = (value: string) => value
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "");

const countryCanonicalName: Record<string, string> = {
  korea: "southkorea",
  southkorea: "southkorea",
  hongkong: "hongkong",
  unitedkingdom: "unitedkingdom",
  unitedstates: "unitedstates",
};

export function getTransferInfo(stationName: string, country: string): TransferInfo | null {
  const normalizedName = normalizeMatchKey(stationName);
  const normalizedCountry = countryCanonicalName[normalizeMatchKey(country)] || normalizeMatchKey(country);
  
  // Find match using fuzzy names
  for (const key of Object.keys(transferCatalog)) {
    const entry = transferCatalog[key];
    
    // Check if country matches
    const entryCountry = countryCanonicalName[normalizeMatchKey(entry.country)] || normalizeMatchKey(entry.country);
    const countryMatch = normalizedCountry === entryCountry;
                         
    if (countryMatch) {
      // Check if station name matches partially or exactly
      const entryStation = normalizeMatchKey(entry.stationName);
      const stationMatch = normalizedName.includes(entryStation) || entryStation.includes(normalizedName);
                           
      if (stationMatch) {
        return entry;
      }
    }
  }
  
  return null;
}
