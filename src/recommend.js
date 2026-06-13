"use strict";

// A small, hand-curated map of city -> signature dishes.
// Keys are compared case-insensitively (see recommendDishes).
const DISHES_BY_CITY = {
  tokyo: ["Sushi", "Ramen", "Okonomiyaki"],
  bangkok: ["Pad Thai", "Som Tam", "Mango Sticky Rice"],
  rome: ["Cacio e Pepe", "Supplì", "Gelato"],
  istanbul: ["Simit", "Balık Ekmek", "Baklava"],
};

/**
 * Recommend a few signature dishes for a city.
 *
 * @param {string} city - City name (case-insensitive).
 * @returns {string[]} Dishes to try, or an empty array if the city is unknown.
 */
function recommendDishes(city) {
  if (typeof city !== "string") {
    return [];
  }
  const key = city.trim().toLowerCase();
  return DISHES_BY_CITY[key] || [];
}

module.exports = { recommendDishes, DISHES_BY_CITY };
