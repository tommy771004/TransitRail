import { searchHongKongMtr } from "../../src/server/hongKongMtr";
import { searchMbtaJourney } from "../../src/server/mbta";
import { searchTflJourney } from "../../src/server/tfl";
import {
  chinaRoutes,
  franceRoutes,
  germanyRoutes,
  hongKongRoutes,
  singaporeRoutes,
  thailandRoutes,
  unitedKingdomRoutes,
  unitedStatesRoutes,
} from "./routes";
import { ProviderBackedScraper, SnapshotScraper } from "./snapshot";

export class SingaporeScraper extends SnapshotScraper {
  constructor() {
    super("LTA", "singapore", singaporeRoutes);
  }
}

export class ThailandScraper extends SnapshotScraper {
  constructor() {
    super("BTS/MRT", "thailand", thailandRoutes);
  }
}

export class HongKongScraper extends ProviderBackedScraper {
  constructor() {
    super("MTR", "hong_kong", hongKongRoutes, searchHongKongMtr);
  }
}

export class UnitedKingdomScraper extends ProviderBackedScraper {
  constructor() {
    super("TfL", "united_kingdom", unitedKingdomRoutes, searchTflJourney);
  }
}

export class UnitedStatesScraper extends ProviderBackedScraper {
  constructor() {
    super("MBTA", "united_states", unitedStatesRoutes, searchMbtaJourney);
  }
}

export class GermanyScraper extends SnapshotScraper {
  constructor() {
    super("DB", "germany", germanyRoutes);
  }
}

export class FranceScraper extends SnapshotScraper {
  constructor() {
    super("SNCF", "france", franceRoutes);
  }
}

export class ChinaScraper extends SnapshotScraper {
  constructor() {
    super("12306", "china", chinaRoutes);
  }
}
