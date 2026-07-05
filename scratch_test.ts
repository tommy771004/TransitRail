import { findScrapedResults } from "./src/data/scraped";

const result = findScrapedResults("japan", "Tokyo", "Shin-Osaka", "2026-07-05");
console.log("Result (Tokyo -> Shin-Osaka):", result ? `${result.length} items` : "null");

const result2 = findScrapedResults("japan", "東京", "新大阪", "2026-07-05");
console.log("Result (東京 -> 新大阪):", result2 ? `${result2.length} items` : "null");
