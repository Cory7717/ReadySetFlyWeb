import { db } from "./server/db";
import { aircraftTypes } from "./shared/schema";
import { and, eq, ilike } from "drizzle-orm";

type SeedType = {
  make: string;
  model: string;
  icaoType?: string | null;
  category: string;
  engineType: string;
  cruiseKtas: string;
  fuelBurnGph: string;
  usableFuelGal: string;
  maxGrossWeightLb: string;
  defaultAltitudeFt?: number | null;
};

const SOURCE_NOTE = "Typical planning estimates; verify POH/AFM.";

const SEED_TYPES: SeedType[] = [
  { make: "Cessna", model: "152", icaoType: "C152", category: "trainer", engineType: "piston", cruiseKtas: "105", fuelBurnGph: "6.0", usableFuelGal: "24.5", maxGrossWeightLb: "1670", defaultAltitudeFt: 4500 },
  { make: "Cessna", model: "172S", icaoType: "C172", category: "trainer", engineType: "piston", cruiseKtas: "122", fuelBurnGph: "8.5", usableFuelGal: "53", maxGrossWeightLb: "2550", defaultAltitudeFt: 5500 },
  { make: "Cessna", model: "182T", icaoType: "C182", category: "piston_single", engineType: "piston", cruiseKtas: "140", fuelBurnGph: "13.5", usableFuelGal: "88", maxGrossWeightLb: "3100", defaultAltitudeFt: 6500 },
  { make: "Cessna", model: "206", icaoType: "C206", category: "piston_single", engineType: "piston", cruiseKtas: "140", fuelBurnGph: "15.0", usableFuelGal: "88", maxGrossWeightLb: "3600", defaultAltitudeFt: 6500 },
  { make: "Piper", model: "PA-28-161 Warrior", icaoType: "P28A", category: "trainer", engineType: "piston", cruiseKtas: "115", fuelBurnGph: "9.0", usableFuelGal: "48", maxGrossWeightLb: "2440", defaultAltitudeFt: 5500 },
  { make: "Piper", model: "PA-28-181 Archer", icaoType: "P28A", category: "trainer", engineType: "piston", cruiseKtas: "120", fuelBurnGph: "10.0", usableFuelGal: "48", maxGrossWeightLb: "2550", defaultAltitudeFt: 5500 },
  { make: "Piper", model: "PA-28R Arrow", icaoType: "P28R", category: "piston_single", engineType: "piston", cruiseKtas: "135", fuelBurnGph: "11.5", usableFuelGal: "72", maxGrossWeightLb: "2750", defaultAltitudeFt: 6500 },
  { make: "Diamond", model: "DA40", icaoType: "DA40", category: "trainer", engineType: "piston", cruiseKtas: "135", fuelBurnGph: "9.5", usableFuelGal: "40", maxGrossWeightLb: "2646", defaultAltitudeFt: 6500 },
  { make: "Diamond", model: "DA42", icaoType: "DA42", category: "piston_twin", engineType: "piston", cruiseKtas: "160", fuelBurnGph: "14.0", usableFuelGal: "76", maxGrossWeightLb: "3935", defaultAltitudeFt: 9000 },
  { make: "Cirrus", model: "SR20", icaoType: "SR20", category: "piston_single", engineType: "piston", cruiseKtas: "155", fuelBurnGph: "10.5", usableFuelGal: "56", maxGrossWeightLb: "3050", defaultAltitudeFt: 6500 },
  { make: "Cirrus", model: "SR22", icaoType: "SR22", category: "piston_single", engineType: "piston", cruiseKtas: "180", fuelBurnGph: "17.0", usableFuelGal: "81", maxGrossWeightLb: "3400", defaultAltitudeFt: 7500 },
  { make: "Beechcraft", model: "Bonanza A36", icaoType: "BE36", category: "piston_single", engineType: "piston", cruiseKtas: "170", fuelBurnGph: "14.0", usableFuelGal: "74", maxGrossWeightLb: "3650", defaultAltitudeFt: 7500 },
  { make: "Beechcraft", model: "Baron B58", icaoType: "BE58", category: "piston_twin", engineType: "piston", cruiseKtas: "190", fuelBurnGph: "28.0", usableFuelGal: "166", maxGrossWeightLb: "5500", defaultAltitudeFt: 9000 },
  { make: "Piper", model: "PA-34 Seneca", icaoType: "PA34", category: "piston_twin", engineType: "piston", cruiseKtas: "180", fuelBurnGph: "26.0", usableFuelGal: "123", maxGrossWeightLb: "4800", defaultAltitudeFt: 9000 },
  { make: "Piper", model: "PA-44 Seminole", icaoType: "PA44", category: "piston_twin", engineType: "piston", cruiseKtas: "160", fuelBurnGph: "18.0", usableFuelGal: "110", maxGrossWeightLb: "3800", defaultAltitudeFt: 8000 },
  { make: "Beechcraft", model: "King Air C90", icaoType: "BE9L", category: "turboprop", engineType: "turboprop", cruiseKtas: "225", fuelBurnGph: "55.0", usableFuelGal: "384", maxGrossWeightLb: "10100", defaultAltitudeFt: 17000 },
  { make: "Pilatus", model: "PC-12", icaoType: "PC12", category: "turboprop", engineType: "turboprop", cruiseKtas: "270", fuelBurnGph: "70.0", usableFuelGal: "402", maxGrossWeightLb: "10450", defaultAltitudeFt: 20000 },
  { make: "Socata", model: "TBM 850", icaoType: "TBM8", category: "turboprop", engineType: "turboprop", cruiseKtas: "300", fuelBurnGph: "60.0", usableFuelGal: "291", maxGrossWeightLb: "7394", defaultAltitudeFt: 28000 },
  { make: "Cessna", model: "208 Caravan", icaoType: "C208", category: "turboprop", engineType: "turboprop", cruiseKtas: "170", fuelBurnGph: "45.0", usableFuelGal: "332", maxGrossWeightLb: "8750", defaultAltitudeFt: 12000 },
  { make: "Honda", model: "HA-420 HondaJet", icaoType: "HDJT", category: "jet", engineType: "jet", cruiseKtas: "340", fuelBurnGph: "95.0", usableFuelGal: "582", maxGrossWeightLb: "10400", defaultAltitudeFt: 41000 },
  { make: "Embraer", model: "Phenom 100", icaoType: "E50P", category: "jet", engineType: "jet", cruiseKtas: "390", fuelBurnGph: "120.0", usableFuelGal: "731", maxGrossWeightLb: "10472", defaultAltitudeFt: 41000 },
  { make: "Cessna", model: "Citation M2", icaoType: "C25M", category: "jet", engineType: "jet", cruiseKtas: "404", fuelBurnGph: "130.0", usableFuelGal: "574", maxGrossWeightLb: "10450", defaultAltitudeFt: 41000 },
  { make: "Cirrus", model: "Vision Jet SF50", icaoType: "SF50", category: "jet", engineType: "jet", cruiseKtas: "305", fuelBurnGph: "60.0", usableFuelGal: "295", maxGrossWeightLb: "6000", defaultAltitudeFt: 28000 },
  { make: "Mooney", model: "M20J", icaoType: "M20J", category: "piston_single", engineType: "piston", cruiseKtas: "150", fuelBurnGph: "10.5", usableFuelGal: "64", maxGrossWeightLb: "2740", defaultAltitudeFt: 7500 },
  { make: "Mooney", model: "M20R Ovation", icaoType: "M20R", category: "piston_single", engineType: "piston", cruiseKtas: "175", fuelBurnGph: "12.5", usableFuelGal: "89", maxGrossWeightLb: "3374", defaultAltitudeFt: 8500 },
  { make: "Beechcraft", model: "Bonanza F33A", icaoType: "BE33", category: "piston_single", engineType: "piston", cruiseKtas: "165", fuelBurnGph: "13.0", usableFuelGal: "74", maxGrossWeightLb: "3400", defaultAltitudeFt: 7500 },
  { make: "Cessna", model: "210", icaoType: "C210", category: "piston_single", engineType: "piston", cruiseKtas: "170", fuelBurnGph: "14.0", usableFuelGal: "90", maxGrossWeightLb: "4000", defaultAltitudeFt: 8500 },
  { make: "Piper", model: "PA-46 Malibu", icaoType: "PA46", category: "piston_single", engineType: "piston", cruiseKtas: "210", fuelBurnGph: "20.0", usableFuelGal: "120", maxGrossWeightLb: "4340", defaultAltitudeFt: 15000 },
  { make: "Piper", model: "PA-46 Meridian", icaoType: "P46T", category: "turboprop", engineType: "turboprop", cruiseKtas: "240", fuelBurnGph: "37.0", usableFuelGal: "170", maxGrossWeightLb: "5092", defaultAltitudeFt: 20000 },
  { make: "Textron", model: "T-6 Texan II", icaoType: "TEX2", category: "turboprop", engineType: "turboprop", cruiseKtas: "285", fuelBurnGph: "65.0", usableFuelGal: "130", maxGrossWeightLb: "6500", defaultAltitudeFt: 18000 },
  { make: "Beechcraft", model: "King Air 350", icaoType: "B350", category: "turboprop", engineType: "turboprop", cruiseKtas: "290", fuelBurnGph: "85.0", usableFuelGal: "539", maxGrossWeightLb: "15000", defaultAltitudeFt: 24000 },
];

async function seedAircraftTypes() {
  try {
    for (const entry of SEED_TYPES) {
      const existing = await db
        .select()
        .from(aircraftTypes)
        .where(and(eq(aircraftTypes.make, entry.make), ilike(aircraftTypes.model, entry.model)))
        .limit(1);
      if (existing.length > 0) {
        continue;
      }
      await db.insert(aircraftTypes).values({
        make: entry.make,
        model: entry.model,
        icaoType: entry.icaoType || null,
        category: entry.category,
        engineType: entry.engineType,
        cruiseKtas: entry.cruiseKtas,
        fuelBurnGph: entry.fuelBurnGph,
        usableFuelGal: entry.usableFuelGal,
        maxGrossWeightLb: entry.maxGrossWeightLb,
        defaultAltitudeFt: entry.defaultAltitudeFt ?? null,
        isVerified: true,
        sourceNote: SOURCE_NOTE,
      });
    }
    console.log("Seeded aircraft types.");
  } catch (error) {
    console.error("Failed to seed aircraft types:", error);
    process.exit(1);
  }
  process.exit(0);
}

seedAircraftTypes();
