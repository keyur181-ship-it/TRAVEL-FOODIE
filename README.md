# Travel Foodie

A tiny starter for matching travelers to local dishes worth seeking out.

Given a city, it returns a few signature dishes to try. It's intentionally small —
a clean base to grow a real travel-food recommender on.

## Usage

```js
const { recommendDishes } = require("./src/recommend");

recommendDishes("Tokyo");
// => ["Sushi", "Ramen", "Okonomiyaki"]
```

Unknown cities return an empty list, so callers can fall back gracefully.

## Develop

```bash
npm test
```

Tests use Node's built-in test runner — no dependencies to install.

## Project layout

| Path | Purpose |
|------|---------|
| `src/recommend.js` | Core recommendation logic |
| `test/recommend.test.js` | Tests for the recommender |
