/**
 * Private browser scenario consumed by a future Playwright worker. It stays
 * outside packages/challenges so the builder cannot optimize for hidden IDs.
 */
export type BrowserScenarioStep =
  | { action: "fill"; selector: string; value: string }
  | { action: "click"; selector: string }
  | { action: "expectCount"; selector: string; value: number }
  | { action: "expectVisible"; selector: string }
  | { action: "reload" };

export const readingListScenario: BrowserScenarioStep[] = [
  { action: "fill", selector: "#title", value: "The Left Hand of Darkness" },
  { action: "click", selector: "button[type=submit]" },
  { action: "expectCount", selector: "[data-testid=book-row]", value: 1 },
  { action: "click", selector: "[data-testid=mark-read]" },
  { action: "reload" },
  { action: "expectVisible", selector: "[data-testid=book-row][data-read=true]" },
];
