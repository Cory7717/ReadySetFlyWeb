export type CourtyardCateringTemplate = {
  id: string;
  category: "Breakfast" | "Beverage Break" | "Snack Break" | "Lunch & Dinner" | "Event Enhancement";
  name: string;
  defaultPrice: number;
  chargeMethod: "per_person" | "per_person_per_day" | "per_event";
  minimumPeople?: number;
  serviceDuration?: string;
  inclusions: string;
  priceNote?: string;
};

export const COURTYARD_CATERING_TEMPLATES: CourtyardCateringTemplate[] = [
  { id: "deluxe-hot-continental", category: "Breakfast", name: "Deluxe Hot Continental Breakfast", defaultPrice: 19.95, chargeMethod: "per_person", minimumPeople: 10, inclusions: "Scrambled eggs with sausage or bacon and potatoes; assorted bagels and pastries with fruit preserves, butter, and cream cheese; assorted cereals with milk; yogurt; whole fruits; assorted hot teas; fruit juices; Starbucks Pike Place coffee." },
  { id: "continental-breakfast", category: "Breakfast", name: "Continental Breakfast", defaultPrice: 17.95, chargeMethod: "per_person", minimumPeople: 10, inclusions: "Assorted bagels and pastries with fruit preserves, butter, and cream cheese; assorted cereals with milk; assorted yogurts; seasonal whole fruits; assorted hot teas; fruit juices; Starbucks Pike Place coffee." },
  { id: "light-continental-breakfast", category: "Breakfast", name: "Light Continental Breakfast", defaultPrice: 15.95, chargeMethod: "per_person", minimumPeople: 10, inclusions: "Assorted bagels and pastries with fruit preserves, butter, and cream cheese; seasonal whole fruits; assorted hot teas; fruit juices; Starbucks Pike Place coffee." },
  { id: "yogurt-parfait-bar", category: "Breakfast", name: "Yogurt Parfait Bar", defaultPrice: 14.95, chargeMethod: "per_person", minimumPeople: 10, inclusions: "Assorted yogurts with crunchy granola, seasonal fruits and berries, and assorted nuts; assorted pastries with fruit preserves, butter, and cream cheese; fruit juices; Starbucks Pike Place coffee." },
  { id: "breakfast-toast-table", category: "Breakfast", name: "Breakfast Toast Table", defaultPrice: 12.95, chargeMethod: "per_person", minimumPeople: 10, inclusions: "Build-your-own toast with assorted bread slices and bagels; assorted pastries with fruit preserves, cream cheese, and butter; Starbucks Pike Place coffee." },
  { id: "morning-coffee", category: "Beverage Break", name: "Morning Coffee", defaultPrice: 6.5, chargeMethod: "per_person", inclusions: "Starbucks Pike Place coffee served with assorted hot teas." },
  { id: "refreshing", category: "Beverage Break", name: "Refreshing", defaultPrice: 8.5, chargeMethod: "per_person", inclusions: "Starbucks Pike Place coffee, assorted fruit juices, and assorted hot teas." },
  { id: "rise-and-pop", category: "Beverage Break", name: "Rise and Pop", defaultPrice: 8.5, chargeMethod: "per_person", inclusions: "Starbucks Pike Place coffee, assorted Pepsi products, and assorted hot tea." },
  { id: "dozen-danish-and-coffee", category: "Beverage Break", name: "Dozen Danish and Coffee", defaultPrice: 18.95, chargeMethod: "per_person", inclusions: "Assorted pastries, croissants, or bagels with fruit preserves, cream cheese, and butter; Starbucks Pike Place coffee; assorted hot teas." },
  { id: "energy-break", category: "Snack Break", name: "Energy Break", defaultPrice: 12.95, chargeMethod: "per_person", minimumPeople: 10, serviceDuration: "One hour", inclusions: "Chocolate chip cookies; assorted granola bars; seasonal whole fruits; assorted hot teas; Starbucks Pike Place coffee." },
  { id: "protein-power-break", category: "Snack Break", name: "Protein Power Break", defaultPrice: 14.95, chargeMethod: "per_person", minimumPeople: 10, serviceDuration: "One hour", inclusions: "Assorted packaged nuts and trail mix; assorted granola and energy bars; seasonal whole fruit; Naked fruit juices; assorted Pepsi products." },
  { id: "fresh-and-healthy-break", category: "Snack Break", name: "Fresh and Healthy Break", defaultPrice: 15.95, chargeMethod: "per_person", minimumPeople: 10, serviceDuration: "One hour", inclusions: "Assorted vegetable and fruit tray; snack pretzels; packaged nuts; assorted Pepsi products." },
  { id: "bistro-deli-choice", category: "Lunch & Dinner", name: "Bistro Deli Choice", defaultPrice: 19.95, chargeMethod: "per_person", inclusions: "Choice of Chicken Caesar Wrap, Chunk White Tuna Sandwich, Turkey BLT, Ham & Swiss, Roast Beef & Havarti, Chicken Caesar Salad Sandwich, or half sandwich and soup combo; Miss Vickie's chips; fresh fruit cup or coleslaw; dessert; Pepsi products." },
  { id: "bistro-market-table", category: "Lunch & Dinner", name: "Bistro Market Table", defaultPrice: 23.95, chargeMethod: "per_person", minimumPeople: 10, inclusions: "Salad bar with choice of three sandwiches: Chicken Caesar Wrap, Chunk White Tuna, Turkey BLT, or Ham & Swiss; potato chips; coleslaw; fresh fruit; assorted desserts; Pepsi products." },
  { id: "bistro-taco-buffet", category: "Lunch & Dinner", name: "Bistro Taco Buffet", defaultPrice: 24.95, chargeMethod: "per_person", minimumPeople: 10, inclusions: "Shredded chicken and ground beef with soft tortillas; chicken tortilla soup; tortilla chips; salsa; salad bar; guacamole, shredded lettuce, shredded cheese, sour cream, and pico de gallo; chocolate chip cookies; assorted Pepsi products." },
  { id: "bistro-fajita-buffet", category: "Lunch & Dinner", name: "Bistro Fajita Buffet", defaultPrice: 28.95, chargeMethod: "per_person", minimumPeople: 10, inclusions: "Grilled chicken or grilled steak with soft tortillas; chicken tortilla soup; tortilla chips; salsa; garden salad; guacamole, shredded lettuce, shredded cheese, sour cream, and pico de gallo; chocolate chip cookies; assorted Pepsi products." },
  { id: "bistro-burger-choice", category: "Lunch & Dinner", name: "Bistro Burger Choice", defaultPrice: 22.95, chargeMethod: "per_person", inclusions: "Bistro Burger or grilled chicken breast; choice of two sides: creamy coleslaw, bistro fries, side salad, fresh-cut fruit, or potato chips; choice of three toppings plus condiments; chocolate chip cookie; assorted Pepsi products. Optional crispy bacon is $2 per person." },
  { id: "build-a-burger-table", category: "Lunch & Dinner", name: "Build a Burger Table", defaultPrice: 24.95, chargeMethod: "per_person", minimumPeople: 10, inclusions: "Bistro Burger or grilled chicken breast for customizable burgers; choice of two sides and three toppings plus condiments; assorted desserts; Pepsi products. Optional crispy bacon is $2 per person." },
  { id: "beer-and-wine-package", category: "Event Enhancement", name: "Beer & Wine Package", defaultPrice: 0, chargeMethod: "per_event", inclusions: "Customized beer and wine selection based on the requested activation and event needs.", priceNote: "Custom pricing - confirm with the catering manager." },
];

export function cateringTemplateInstructions(template: CourtyardCateringTemplate) {
  return [
    `Includes: ${template.inclusions}`,
    template.minimumPeople ? `Minimum ${template.minimumPeople} people.` : "",
    template.serviceDuration ? `${template.serviceDuration} of service.` : "",
    template.priceNote || "",
  ].filter(Boolean).join(" ");
}

export function cateringSelectionsFromContract(text: string) {
  const matches = COURTYARD_CATERING_TEMPLATES.map((template) => {
    const escaped = template.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`\\b${escaped.replace(/ /g, "\\s+")}\\b`, "i").exec(text);
    return match ? { template, index: match.index, length: match[0].length } : null;
  }).filter((match): match is { template: CourtyardCateringTemplate; index: number; length: number } => Boolean(match));
  const accepted: typeof matches = [];
  for (const match of [...matches].sort((a, b) => b.length - a.length)) {
    const overlaps = accepted.some((item) => match.index < item.index + item.length && item.index < match.index + match.length);
    if (!overlaps) accepted.push(match);
  }
  return accepted.sort((a, b) => a.index - b.index).map(({ template, index, length }) => {
    const nearby = text.slice(index + length, index + length + 100);
    const contractedPrice = nearby.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/)?.[1];
    return {
      templateId: template.id,
      menuCategory: template.category,
      name: template.name,
      serviceDates: "All event dates",
      chargeMethod: template.chargeMethod,
      quantity: 1,
      unitPrice: contractedPrice ? Number(contractedPrice.replace(/,/g, "")) : template.defaultPrice,
      includedQuantity: 0,
      refillPrice: 0,
      instructions: cateringTemplateInstructions(template),
    };
  });
}
