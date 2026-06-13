"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const { recommendDishes } = require("../src/recommend");

test("returns dishes for a known city", () => {
  assert.deepStrictEqual(recommendDishes("Tokyo"), [
    "Sushi",
    "Ramen",
    "Okonomiyaki",
  ]);
});

test("is case-insensitive and trims whitespace", () => {
  assert.deepStrictEqual(recommendDishes("  bangkok  "), [
    "Pad Thai",
    "Som Tam",
    "Mango Sticky Rice",
  ]);
});

test("returns dishes for a multi-word city name", () => {
  assert.deepStrictEqual(recommendDishes("Mexico City"), [
    "Tacos al Pastor",
    "Tamales",
    "Churros",
  ]);
});

test("returns an empty array for an unknown city", () => {
  assert.deepStrictEqual(recommendDishes("Atlantis"), []);
});

test("returns an empty array for non-string input", () => {
  assert.deepStrictEqual(recommendDishes(null), []);
});
