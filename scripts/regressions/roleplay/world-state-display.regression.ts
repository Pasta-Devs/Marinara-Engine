// The World State tracker's display: the temperature gauge in either unit, and the weather class of a description.
import assert from "node:assert/strict";
import {
  classifyWorldWeather,
  getTemperatureGaugeDisplay,
} from "../../../packages/client/src/lib/world-state-helpers.js";

assert.equal(getTemperatureGaugeDisplay("15°C", "celsius").label, "15°C");
assert.equal(getTemperatureGaugeDisplay("59 Fahrenheit", "celsius").label, "15°C");
assert.equal(getTemperatureGaugeDisplay("15°C", "celsius").isPure, true);
assert.equal(getTemperatureGaugeDisplay("Around 15°C, windy skies ahead", "celsius").isPure, false);
assert.equal(
  getTemperatureGaugeDisplay("Around 15°C, windy skies ahead", "celsius").label,
  "Around 15°C, windy skies ahead",
);
assert.equal(classifyWorldWeather("snowstorm"), "snow");
assert.equal(classifyWorldWeather("sandstorm"), "sand");
assert.equal(classifyWorldWeather("firestorm"), "fire");
assert.equal(classifyWorldWeather("windstorm"), "wind");
assert.equal(classifyWorldWeather("storm"), "heavy-rain");
