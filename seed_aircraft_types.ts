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
  { make: "Cessna", model: "150", icaoType: "C150", category: "trainer", engineType: "piston", cruiseKtas: "95", fuelBurnGph: "5.5", usableFuelGal: "22.5", maxGrossWeightLb: "1600", defaultAltitudeFt: 4500 },
  { make: "Cessna", model: "152", icaoType: "C152", category: "trainer", engineType: "piston", cruiseKtas: "105", fuelBurnGph: "6.0", usableFuelGal: "24.5", maxGrossWeightLb: "1670", defaultAltitudeFt: 4500 },
  { make: "Cessna", model: "172N", icaoType: "C172", category: "trainer", engineType: "piston", cruiseKtas: "115", fuelBurnGph: "8.0", usableFuelGal: "40", maxGrossWeightLb: "2300", defaultAltitudeFt: 5500 },
  { make: "Cessna", model: "172S", icaoType: "C172", category: "trainer", engineType: "piston", cruiseKtas: "122", fuelBurnGph: "8.5", usableFuelGal: "53", maxGrossWeightLb: "2550", defaultAltitudeFt: 5500 },
  { make: "Cessna", model: "172SP", icaoType: "C172", category: "trainer", engineType: "piston", cruiseKtas: "124", fuelBurnGph: "9.0", usableFuelGal: "53", maxGrossWeightLb: "2550", defaultAltitudeFt: 5500 },
  { make: "Cessna", model: "177 Cardinal", icaoType: "C177", category: "piston_single", engineType: "piston", cruiseKtas: "125", fuelBurnGph: "10.0", usableFuelGal: "60", maxGrossWeightLb: "2500", defaultAltitudeFt: 6500 },
  { make: "Cessna", model: "182T", icaoType: "C182", category: "piston_single", engineType: "piston", cruiseKtas: "140", fuelBurnGph: "13.5", usableFuelGal: "88", maxGrossWeightLb: "3100", defaultAltitudeFt: 6500 },
  { make: "Cessna", model: "180", icaoType: "C180", category: "piston_single", engineType: "piston", cruiseKtas: "135", fuelBurnGph: "13.0", usableFuelGal: "60", maxGrossWeightLb: "2800", defaultAltitudeFt: 6500 },
  { make: "Cessna", model: "185", icaoType: "C185", category: "piston_single", engineType: "piston", cruiseKtas: "145", fuelBurnGph: "15.0", usableFuelGal: "88", maxGrossWeightLb: "3350", defaultAltitudeFt: 7500 },
  { make: "Cessna", model: "206", icaoType: "C206", category: "piston_single", engineType: "piston", cruiseKtas: "140", fuelBurnGph: "15.0", usableFuelGal: "88", maxGrossWeightLb: "3600", defaultAltitudeFt: 6500 },
  { make: "Cessna", model: "210", icaoType: "C210", category: "piston_single", engineType: "piston", cruiseKtas: "170", fuelBurnGph: "14.0", usableFuelGal: "90", maxGrossWeightLb: "4000", defaultAltitudeFt: 8500 },
  { make: "Cessna", model: "337 Skymaster", icaoType: "C337", category: "piston_twin", engineType: "piston", cruiseKtas: "165", fuelBurnGph: "18.0", usableFuelGal: "92", maxGrossWeightLb: "4630", defaultAltitudeFt: 9000 },
  { make: "Cessna", model: "310", icaoType: "C310", category: "piston_twin", engineType: "piston", cruiseKtas: "190", fuelBurnGph: "28.0", usableFuelGal: "102", maxGrossWeightLb: "5500", defaultAltitudeFt: 9000 },
  { make: "Cessna", model: "340", icaoType: "C340", category: "piston_twin", engineType: "piston", cruiseKtas: "200", fuelBurnGph: "32.0", usableFuelGal: "163", maxGrossWeightLb: "5990", defaultAltitudeFt: 12000 },
  { make: "Cessna", model: "421", icaoType: "C421", category: "piston_twin", engineType: "piston", cruiseKtas: "220", fuelBurnGph: "40.0", usableFuelGal: "206", maxGrossWeightLb: "7450", defaultAltitudeFt: 16000 },
  { make: "Piper", model: "PA-28-161 Warrior", icaoType: "P28A", category: "trainer", engineType: "piston", cruiseKtas: "115", fuelBurnGph: "9.0", usableFuelGal: "48", maxGrossWeightLb: "2440", defaultAltitudeFt: 5500 },
  { make: "Piper", model: "PA-28-181 Archer", icaoType: "P28A", category: "trainer", engineType: "piston", cruiseKtas: "120", fuelBurnGph: "10.0", usableFuelGal: "48", maxGrossWeightLb: "2550", defaultAltitudeFt: 5500 },
  { make: "Piper", model: "PA-28-140", icaoType: "P28A", category: "trainer", engineType: "piston", cruiseKtas: "105", fuelBurnGph: "8.0", usableFuelGal: "50", maxGrossWeightLb: "2150", defaultAltitudeFt: 5000 },
  { make: "Piper", model: "PA-28-180", icaoType: "P28A", category: "trainer", engineType: "piston", cruiseKtas: "120", fuelBurnGph: "10.0", usableFuelGal: "50", maxGrossWeightLb: "2550", defaultAltitudeFt: 5500 },
  { make: "Piper", model: "PA-28R Arrow", icaoType: "P28R", category: "piston_single", engineType: "piston", cruiseKtas: "135", fuelBurnGph: "11.5", usableFuelGal: "72", maxGrossWeightLb: "2750", defaultAltitudeFt: 6500 },
  { make: "Piper", model: "PA-32-300 Cherokee Six", icaoType: "PA32", category: "piston_single", engineType: "piston", cruiseKtas: "135", fuelBurnGph: "16.0", usableFuelGal: "84", maxGrossWeightLb: "3400", defaultAltitudeFt: 6500 },
  { make: "Piper", model: "PA-32-301 Saratoga", icaoType: "PA32", category: "piston_single", engineType: "piston", cruiseKtas: "155", fuelBurnGph: "17.0", usableFuelGal: "102", maxGrossWeightLb: "3600", defaultAltitudeFt: 8000 },
  { make: "Piper", model: "PA-38 Tomahawk", icaoType: "P38A", category: "trainer", engineType: "piston", cruiseKtas: "100", fuelBurnGph: "6.0", usableFuelGal: "30", maxGrossWeightLb: "1670", defaultAltitudeFt: 4500 },
  { make: "Piper", model: "PA-18 Super Cub", icaoType: "P18", category: "trainer", engineType: "piston", cruiseKtas: "90", fuelBurnGph: "6.0", usableFuelGal: "36", maxGrossWeightLb: "1750", defaultAltitudeFt: 4500 },
  { make: "Piper", model: "PA-22 Tri-Pacer", icaoType: "P22", category: "trainer", engineType: "piston", cruiseKtas: "100", fuelBurnGph: "8.0", usableFuelGal: "36", maxGrossWeightLb: "2000", defaultAltitudeFt: 4500 },
  { make: "Piper", model: "PA-24 Comanche", icaoType: "P24A", category: "piston_single", engineType: "piston", cruiseKtas: "140", fuelBurnGph: "12.0", usableFuelGal: "60", maxGrossWeightLb: "2800", defaultAltitudeFt: 7500 },
  { make: "Piper", model: "PA-30 Twin Comanche", icaoType: "PA30", category: "piston_twin", engineType: "piston", cruiseKtas: "165", fuelBurnGph: "18.0", usableFuelGal: "120", maxGrossWeightLb: "3600", defaultAltitudeFt: 9000 },
  { make: "Piper", model: "PA-31 Navajo", icaoType: "PA31", category: "piston_twin", engineType: "piston", cruiseKtas: "210", fuelBurnGph: "40.0", usableFuelGal: "192", maxGrossWeightLb: "7000", defaultAltitudeFt: 12000 },
  { make: "Diamond", model: "DA40", icaoType: "DA40", category: "trainer", engineType: "piston", cruiseKtas: "135", fuelBurnGph: "9.5", usableFuelGal: "40", maxGrossWeightLb: "2646", defaultAltitudeFt: 6500 },
  { make: "Diamond", model: "DA20", icaoType: "DA20", category: "trainer", engineType: "piston", cruiseKtas: "125", fuelBurnGph: "6.0", usableFuelGal: "24", maxGrossWeightLb: "1760", defaultAltitudeFt: 5500 },
  { make: "Diamond", model: "DA42", icaoType: "DA42", category: "piston_twin", engineType: "piston", cruiseKtas: "160", fuelBurnGph: "14.0", usableFuelGal: "76", maxGrossWeightLb: "3935", defaultAltitudeFt: 9000 },
  { make: "Diamond", model: "DA62", icaoType: "DA62", category: "piston_twin", engineType: "piston", cruiseKtas: "180", fuelBurnGph: "18.0", usableFuelGal: "86", maxGrossWeightLb: "5070", defaultAltitudeFt: 10000 },
  { make: "Cirrus", model: "SR20", icaoType: "SR20", category: "piston_single", engineType: "piston", cruiseKtas: "155", fuelBurnGph: "10.5", usableFuelGal: "56", maxGrossWeightLb: "3050", defaultAltitudeFt: 6500 },
  { make: "Cirrus", model: "SR22", icaoType: "SR22", category: "piston_single", engineType: "piston", cruiseKtas: "180", fuelBurnGph: "17.0", usableFuelGal: "81", maxGrossWeightLb: "3400", defaultAltitudeFt: 7500 },
  { make: "Cirrus", model: "SR22T", icaoType: "SR22", category: "piston_single", engineType: "piston", cruiseKtas: "213", fuelBurnGph: "18.0", usableFuelGal: "92", maxGrossWeightLb: "3600", defaultAltitudeFt: 8500 },
  { make: "Beechcraft", model: "Bonanza A36", icaoType: "BE36", category: "piston_single", engineType: "piston", cruiseKtas: "170", fuelBurnGph: "14.0", usableFuelGal: "74", maxGrossWeightLb: "3650", defaultAltitudeFt: 7500 },
  { make: "Beechcraft", model: "Bonanza F33A", icaoType: "BE33", category: "piston_single", engineType: "piston", cruiseKtas: "165", fuelBurnGph: "13.0", usableFuelGal: "74", maxGrossWeightLb: "3400", defaultAltitudeFt: 7500 },
  { make: "Beechcraft", model: "Sundowner C23", icaoType: "BE23", category: "trainer", engineType: "piston", cruiseKtas: "115", fuelBurnGph: "10.0", usableFuelGal: "54", maxGrossWeightLb: "2450", defaultAltitudeFt: 5500 },
  { make: "Beechcraft", model: "Musketeer B19", icaoType: "BE19", category: "trainer", engineType: "piston", cruiseKtas: "110", fuelBurnGph: "9.0", usableFuelGal: "57", maxGrossWeightLb: "2250", defaultAltitudeFt: 5500 },
  { make: "Beechcraft", model: "Duchess BE76", icaoType: "BE76", category: "piston_twin", engineType: "piston", cruiseKtas: "160", fuelBurnGph: "18.0", usableFuelGal: "100", maxGrossWeightLb: "3900", defaultAltitudeFt: 8000 },
  { make: "Beechcraft", model: "Travel Air", icaoType: "BE95", category: "piston_twin", engineType: "piston", cruiseKtas: "180", fuelBurnGph: "24.0", usableFuelGal: "166", maxGrossWeightLb: "5000", defaultAltitudeFt: 9000 },
  { make: "Beechcraft", model: "Baron B58", icaoType: "BE58", category: "piston_twin", engineType: "piston", cruiseKtas: "190", fuelBurnGph: "28.0", usableFuelGal: "166", maxGrossWeightLb: "5500", defaultAltitudeFt: 9000 },
  { make: "Piper", model: "PA-34 Seneca", icaoType: "PA34", category: "piston_twin", engineType: "piston", cruiseKtas: "180", fuelBurnGph: "26.0", usableFuelGal: "123", maxGrossWeightLb: "4800", defaultAltitudeFt: 9000 },
  { make: "Piper", model: "PA-44 Seminole", icaoType: "PA44", category: "piston_twin", engineType: "piston", cruiseKtas: "160", fuelBurnGph: "18.0", usableFuelGal: "110", maxGrossWeightLb: "3800", defaultAltitudeFt: 8000 },
  { make: "Mooney", model: "M20J", icaoType: "M20J", category: "piston_single", engineType: "piston", cruiseKtas: "150", fuelBurnGph: "10.5", usableFuelGal: "64", maxGrossWeightLb: "2740", defaultAltitudeFt: 7500 },
  { make: "Mooney", model: "M20R Ovation", icaoType: "M20R", category: "piston_single", engineType: "piston", cruiseKtas: "175", fuelBurnGph: "12.5", usableFuelGal: "89", maxGrossWeightLb: "3374", defaultAltitudeFt: 8500 },
  { make: "Mooney", model: "M20S Eagle", icaoType: "M20S", category: "piston_single", engineType: "piston", cruiseKtas: "170", fuelBurnGph: "12.0", usableFuelGal: "89", maxGrossWeightLb: "3200", defaultAltitudeFt: 8500 },
  { make: "Mooney", model: "M20K 231", icaoType: "M20K", category: "piston_single", engineType: "piston", cruiseKtas: "180", fuelBurnGph: "12.0", usableFuelGal: "89", maxGrossWeightLb: "3200", defaultAltitudeFt: 9000 },
  { make: "Grumman", model: "AA-5B Tiger", icaoType: "A5B", category: "trainer", engineType: "piston", cruiseKtas: "132", fuelBurnGph: "10.0", usableFuelGal: "51", maxGrossWeightLb: "2200", defaultAltitudeFt: 5500 },
  { make: "Grumman", model: "AA-1A", icaoType: "A1A", category: "trainer", engineType: "piston", cruiseKtas: "108", fuelBurnGph: "7.0", usableFuelGal: "24", maxGrossWeightLb: "1600", defaultAltitudeFt: 4500 },
  { make: "Tecnam", model: "P2006T", icaoType: "P06T", category: "piston_twin", engineType: "piston", cruiseKtas: "160", fuelBurnGph: "9.0", usableFuelGal: "52", maxGrossWeightLb: "2734", defaultAltitudeFt: 9000 },
  { make: "Tecnam", model: "P2010", icaoType: "P201", category: "trainer", engineType: "piston", cruiseKtas: "140", fuelBurnGph: "10.0", usableFuelGal: "53", maxGrossWeightLb: "2650", defaultAltitudeFt: 6500 },
  { make: "Flight Design", model: "CTLS", icaoType: "FDCT", category: "trainer", engineType: "piston", cruiseKtas: "115", fuelBurnGph: "5.0", usableFuelGal: "34", maxGrossWeightLb: "1320", defaultAltitudeFt: 5500 },
  { make: "Vans", model: "RV-7", icaoType: "RV7", category: "piston_single", engineType: "piston", cruiseKtas: "170", fuelBurnGph: "9.0", usableFuelGal: "42", maxGrossWeightLb: "1800", defaultAltitudeFt: 7500 },
  { make: "Vans", model: "RV-10", icaoType: "RV10", category: "piston_single", engineType: "piston", cruiseKtas: "170", fuelBurnGph: "14.0", usableFuelGal: "60", maxGrossWeightLb: "2700", defaultAltitudeFt: 8500 },
  { make: "Beechcraft", model: "King Air C90", icaoType: "BE9L", category: "turboprop", engineType: "turboprop", cruiseKtas: "225", fuelBurnGph: "55.0", usableFuelGal: "384", maxGrossWeightLb: "10100", defaultAltitudeFt: 17000 },
  { make: "Beechcraft", model: "King Air 200", icaoType: "BE20", category: "turboprop", engineType: "turboprop", cruiseKtas: "280", fuelBurnGph: "80.0", usableFuelGal: "549", maxGrossWeightLb: "12500", defaultAltitudeFt: 24000 },
  { make: "Pilatus", model: "PC-12", icaoType: "PC12", category: "turboprop", engineType: "turboprop", cruiseKtas: "270", fuelBurnGph: "70.0", usableFuelGal: "402", maxGrossWeightLb: "10450", defaultAltitudeFt: 20000 },
  { make: "Pilatus", model: "PC-6 Turbo Porter", icaoType: "PC6T", category: "turboprop", engineType: "turboprop", cruiseKtas: "145", fuelBurnGph: "35.0", usableFuelGal: "155", maxGrossWeightLb: "6172", defaultAltitudeFt: 12000 },
  { make: "Socata", model: "TBM 850", icaoType: "TBM8", category: "turboprop", engineType: "turboprop", cruiseKtas: "300", fuelBurnGph: "60.0", usableFuelGal: "291", maxGrossWeightLb: "7394", defaultAltitudeFt: 28000 },
  { make: "Daher", model: "TBM 900", icaoType: "TBM9", category: "turboprop", engineType: "turboprop", cruiseKtas: "330", fuelBurnGph: "65.0", usableFuelGal: "292", maxGrossWeightLb: "7394", defaultAltitudeFt: 28000 },
  { make: "Cessna", model: "208 Caravan", icaoType: "C208", category: "turboprop", engineType: "turboprop", cruiseKtas: "170", fuelBurnGph: "45.0", usableFuelGal: "332", maxGrossWeightLb: "8750", defaultAltitudeFt: 12000 },
  { make: "Quest", model: "Kodiak 100", icaoType: "KODI", category: "turboprop", engineType: "turboprop", cruiseKtas: "170", fuelBurnGph: "45.0", usableFuelGal: "320", maxGrossWeightLb: "7255", defaultAltitudeFt: 12000 },
  { make: "Honda", model: "HA-420 HondaJet", icaoType: "HDJT", category: "jet", engineType: "jet", cruiseKtas: "340", fuelBurnGph: "95.0", usableFuelGal: "582", maxGrossWeightLb: "10400", defaultAltitudeFt: 41000 },
  { make: "Embraer", model: "Phenom 100", icaoType: "E50P", category: "jet", engineType: "jet", cruiseKtas: "390", fuelBurnGph: "120.0", usableFuelGal: "731", maxGrossWeightLb: "10472", defaultAltitudeFt: 41000 },
  { make: "Cessna", model: "Citation M2", icaoType: "C25M", category: "jet", engineType: "jet", cruiseKtas: "404", fuelBurnGph: "130.0", usableFuelGal: "574", maxGrossWeightLb: "10450", defaultAltitudeFt: 41000 },
  { make: "Cessna", model: "Citation CJ1", icaoType: "C525", category: "jet", engineType: "jet", cruiseKtas: "380", fuelBurnGph: "135.0", usableFuelGal: "504", maxGrossWeightLb: "10100", defaultAltitudeFt: 41000 },
  { make: "Cessna", model: "Citation CJ2", icaoType: "C525A", category: "jet", engineType: "jet", cruiseKtas: "410", fuelBurnGph: "150.0", usableFuelGal: "583", maxGrossWeightLb: "12000", defaultAltitudeFt: 41000 },
  { make: "Cessna", model: "Citation CJ3", icaoType: "C25B", category: "jet", engineType: "jet", cruiseKtas: "416", fuelBurnGph: "175.0", usableFuelGal: "625", maxGrossWeightLb: "13870", defaultAltitudeFt: 45000 },
  { make: "Cessna", model: "Citation CJ4", icaoType: "C25C", category: "jet", engineType: "jet", cruiseKtas: "450", fuelBurnGph: "190.0", usableFuelGal: "792", maxGrossWeightLb: "17110", defaultAltitudeFt: 45000 },
  { make: "Cessna", model: "Citation XLS", icaoType: "C56X", category: "jet", engineType: "jet", cruiseKtas: "430", fuelBurnGph: "200.0", usableFuelGal: "1100", maxGrossWeightLb: "20000", defaultAltitudeFt: 45000 },
  { make: "Cirrus", model: "Vision Jet SF50", icaoType: "SF50", category: "jet", engineType: "jet", cruiseKtas: "305", fuelBurnGph: "60.0", usableFuelGal: "295", maxGrossWeightLb: "6000", defaultAltitudeFt: 28000 },
  { make: "Learjet", model: "45", icaoType: "LJ45", category: "jet", engineType: "jet", cruiseKtas: "465", fuelBurnGph: "220.0", usableFuelGal: "931", maxGrossWeightLb: "21500", defaultAltitudeFt: 45000 },
  { make: "Gulfstream", model: "G280", icaoType: "G280", category: "jet", engineType: "jet", cruiseKtas: "470", fuelBurnGph: "260.0", usableFuelGal: "1670", maxGrossWeightLb: "39500", defaultAltitudeFt: 45000 },
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
