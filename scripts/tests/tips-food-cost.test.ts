import assert from "node:assert/strict";
import test from "node:test";
import { buildBlankFoodWasteLogPdf, calculateEmployeeMealRecipe, EMPLOYEE_MEAL_RECIPES, parseVendorInvoice } from "../../server/routes/tips";

test("US Foods invoice lines map pack pricing to a per-unit food cost", () => {
  const parsed = parseVendorInvoice(`
US Foods, Inc.
09/03/2026
4715602
INVOICE NUMBER
110CS7355280AVOCADO, HASS BRKER STG 2-3 #2PACKER48 EACS$43.7800$43.78
110CS9922765EGG, SHL LG GRD A BRN CG/FR +EGLNVW FRMS15 DZCS$43.0200$43.02
`, "us-foods.pdf");
  assert.equal(parsed.vendor, "US Foods");
  assert.equal(parsed.invoiceNumber, "4715602");
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].costingUnit, "each");
  assert.equal(parsed.items[0].unitsPerPack, 48);
  assert.equal(Number(parsed.items[0].costPerUnit.toFixed(4)), 0.9121);
  assert.equal(parsed.items[1].unitsPerPack, 180);
});

test("Hardie's customer statements return a useful no-line-items warning", () => {
  const parsed = parseVendorInvoice("Hardie’s Fresh Foods\nCUSTOMER STATEMENT\nINVOICE # 07107921 $248.37", "hardies-statement.pdf");
  assert.equal(parsed.vendor, "Hardie's Fresh Foods");
  assert.equal(parsed.items.length, 0);
  assert.match(parsed.warning || "", /customer statement/i);
});

test("Hardie's detailed invoice maps produce counts and unit costs", () => {
  const parsed = parseVendorInvoice(`
Dairyland Produce, LLC (dba Hardie’s Fresh Foods)
INVOICE/POD
07107921
DATE/TRIP
09/03/26 / 00646982
2202408ORANGE CHOICE12 CT10.0420.08
1170149BLUEBERRY12/6 OZ40.0040.00
`, "hardies-invoice.pdf");
  assert.equal(parsed.invoiceNumber, "07107921");
  assert.equal(parsed.invoiceDate, "2026-09-03");
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].itemName, "ORANGE CHOICE");
  assert.equal(parsed.items[0].unitsPerPack, 12);
  assert.equal(Number(parsed.items[0].costPerUnit.toFixed(4)), 0.8367);
});

test("US Foods supports multi-part packs, decimal sizes, trailing price codes, and recap duplicates", () => {
  const repeatedSoda = "110CS3554565SODA ASSORTED24/12 OZTCS$21.5700$21.57";
  const parsed = parseVendorInvoice(`
US Foods, Inc.
${repeatedSoda}
110CS6776926MUFFIN VARIETY2/12/4 OZCS$31.2000$31.20
110CS1234567MILK CHOCOLATE25/.5 PTBCS$14.9600$14.96
${repeatedSoda}
`, "us-foods.pdf");
  assert.equal(parsed.items.length, 3);
  assert.equal(parsed.items.find((item) => item.vendorItemNumber === "3554565")?.unitsPerPack, 24);
  assert.equal(parsed.items.find((item) => item.vendorItemNumber === "6776926")?.unitsPerPack, 24);
  assert.equal(parsed.items.find((item) => item.vendorItemNumber === "1234567")?.unitsPerPack, 25);
});

test("printable food-waste form produces a valid PDF document", async () => {
  const pdf = await buildBlankFoodWasteLogPdf();
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(pdf.length > 2_000);
});

test("employee meal recipes calculate ingredient cost from current catalog units", () => {
  const recipe = EMPLOYEE_MEAL_RECIPES.find((item) => item.id === "breakfast-croissant");
  assert.ok(recipe);
  const result = calculateEmployeeMealRecipe(recipe, [
    { id: "1", itemName: "Butter Croissant", costingUnit: "each", costPerUnit: "1.50" },
    { id: "2", itemName: "Cage Free Egg Shell", costingUnit: "each", costPerUnit: "0.20" },
    { id: "3", itemName: "White Cheddar Slice", costingUnit: "each", costPerUnit: "0.30" },
    { id: "4", itemName: "Ham Sliced", costingUnit: "lb", costPerUnit: "4.00" },
  ]);
  assert.equal(result.complete, true);
  assert.equal(result.servingCost, 2.5);
});
