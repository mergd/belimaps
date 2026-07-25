/** Heuristics for whether a Maps place is food/drink (Beli-relevant). */

const FOOD_CATEGORY_RE =
  /\b(restaurant|cafe|café|coffee|bar|bakery|bistro|brasserie|pub|tavern|brewery|winery|wine\s*bar|cocktail|food|sushi|pizza|ramen|noodle|diner|eatery|grill|steakhouse|seafood|bbq|barbecue|takeaway|takeout|meal|dessert|ice\s*cream|gelato|pastry|donut|bagel|sandwich|burger|taco|mexican|italian|chinese|japanese|thai|indian|korean|vietnamese|mediterranean|middle\s*eastern|greek|french|irish|brunch|breakfast|lunch|dinner|juice|smoothie|tea\s*house|teahouse|patisserie|chocolatier|deli|delicatessen|gastropub|tapas|omakase|izakaya|yakitori|hot\s*pot|dim\s*sum|poke|salad|vegan|vegetarian|halal|kosher)\b/i;

const NON_FOOD_CATEGORY_RE =
  /\b(shipping|mailing|mail\s*service|post\s*office|ups|fedex|bank|atm|gas\s*station|petrol|parking|pharmacy|hospital|clinic|dentist|doctor|school|university|library|museum|church|temple|mosque|hotel|motel|hostel|apartment|real\s*estate|car\s*wash|auto\s*repair|laundry|dry\s*clean|gym|fitness|salon|barber|spa|nail|electronics|hardware|furniture|clothing|apparel|supermarket|convenience\s*store|liquor\s*store|tobacco|vape|storage|warehouse|office|coworking|police|fire\s*station|embassy|courthouse|airport|train\s*station|subway|bus\s*stop|transit)\b/i;

const NON_FOOD_NAME_RE =
  /\b(ups\s*store|fedex\s*office|u\.?s\.?\s*postal|post\s*office|atm|bank of|wells fargo|chase bank|gas\s*station|shell station|chevron|parking garage|parking lot)\b/i;

/**
 * Place type / tagline from the detail panel (e.g. "Irish restaurant").
 * Keep queries small — only near the h1.
 */
export function extractPlaceCategory(root: ParentNode = document): string | null {
  const h1 = root.querySelector("h1");
  if (!h1) return null;

  const cluster = h1.parentElement?.parentElement ?? h1.parentElement ?? h1;
  const candidates: string[] = [];

  for (const el of cluster.querySelectorAll<HTMLElement>("button, a")) {
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length < 3 || text.length > 60) continue;
    if (FOOD_CATEGORY_RE.test(text) || NON_FOOD_CATEGORY_RE.test(text)) {
      candidates.push(text);
    }
  }

  candidates.sort((a, b) => a.length - b.length);
  if (candidates[0]) return candidates[0];

  // Rating line: "4.7 (827) · $20–70 · Irish restaurant"
  for (const el of cluster.querySelectorAll<HTMLElement>("button, span")) {
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text.includes("·")) continue;
    for (const part of text.split("·").map((p) => p.trim())) {
      if (FOOD_CATEGORY_RE.test(part) || NON_FOOD_CATEGORY_RE.test(part)) return part;
    }
  }

  try {
    const href = location.href.toLowerCase();
    if (href.includes("shipping_and_mailing") || href.includes("mailing_service")) {
      return "shipping and mailing service";
    }
  } catch {
    /* ignore */
  }

  return null;
}

export function shouldShowBeliForPlace(categoryOrName: string | null): boolean {
  if (!categoryOrName) return true;
  if (NON_FOOD_NAME_RE.test(categoryOrName)) return false;
  if (NON_FOOD_CATEGORY_RE.test(categoryOrName) && !FOOD_CATEGORY_RE.test(categoryOrName)) {
    return false;
  }
  return true;
}
