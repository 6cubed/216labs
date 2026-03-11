import { db } from "../server/db.js";
import { segments } from "@shared/schema";

const SEEDS = [
  // Original 3
  { name: "Dublin", slug: "dublin-ireland", country: "Ireland", minLat: 53.25, maxLat: 53.45, minLon: -6.45, maxLon: -6.1 },
  { name: "Galway", slug: "galway-ireland", country: "Ireland", minLat: 53.25, maxLat: 53.35, minLon: -9.15, maxLon: -8.95 },
  { name: "Zurich", slug: "zurich-switzerland", country: "Switzerland", minLat: 47.35, maxLat: 47.42, minLon: 8.48, maxLon: 8.6 },

  // 10 Irish neighbourhoods (~10k population catchments), LLM-named
  { name: "Northgate Commons", slug: "northgate-commons", country: "Ireland",       // Swords, North Co. Dublin (~10k core)
    minLat: 53.44, maxLat: 53.48, minLon: -6.26, maxLon: -6.20 },
  { name: "Velvet Shore", slug: "velvet-shore", country: "Ireland",                 // Malahide, coastal Dublin (~10k)
    minLat: 53.44, maxLat: 53.46, minLon: -6.18, maxLon: -6.13 },
  { name: "The Headland", slug: "the-headland", country: "Ireland",                 // Bray, north Wicklow (~10k core)
    minLat: 53.18, maxLat: 53.22, minLon: -6.14, maxLon: -6.08 },
  { name: "Lakelight", slug: "lakelight", country: "Ireland",                       // Killarney, Kerry (~10k)
    minLat: 52.04, maxLat: 52.07, minLon: -9.55, maxLon: -9.48 },
  { name: "Harbour Mist", slug: "harbour-mist", country: "Ireland",                 // Westport, Mayo (~10k)
    minLat: 53.79, maxLat: 53.81, minLon: -9.55, maxLon: -9.50 },
  { name: "Banner Cross", slug: "banner-cross", country: "Ireland",                 // Ennis, Clare (~10k core)
    minLat: 52.83, maxLat: 52.86, minLon: -9.00, maxLon: -8.95 },
  { name: "Bridgewater", slug: "bridgewater", country: "Ireland",                   // Athlone, Westmeath (~10k core)
    minLat: 53.41, maxLat: 53.44, minLon: -7.97, maxLon: -7.92 },
  { name: "Marble Row", slug: "marble-row", country: "Ireland",                     // Kilkenny city (~10k core)
    minLat: 52.64, maxLat: 52.67, minLon: -7.28, maxLon: -7.23 },
  { name: "Dreamfield", slug: "dreamfield", country: "Ireland",                     // Sligo town (~10k core)
    minLat: 54.26, maxLat: 54.29, minLon: -8.49, maxLon: -8.45 },
  { name: "Cathair Geal", slug: "cathair-geal", country: "Ireland",                 // Letterkenny, Donegal (~10k core)
    minLat: 54.94, maxLat: 54.97, minLon: -7.76, maxLon: -7.72 },
];

async function seed() {
  for (const row of SEEDS) {
    await db.insert(segments).values(row).onConflictDoNothing();
  }
  console.log(`Seeded ${SEEDS.length} segments`);
}

seed().catch(console.error).finally(() => process.exit(0));
