/** Fisher-Yates shuffle. Returns a new array; does not mutate the input. */
export function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Picks a weighted-random item. `items` is [{item, weight}]. */
export function weightedPick(weightedItems) {
  const totalWeight = weightedItems.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of weightedItems) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }
  return weightedItems[weightedItems.length - 1].item;
}
