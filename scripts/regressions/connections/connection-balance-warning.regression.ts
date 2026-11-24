// A Connection card warns about its balance only when the service says what is left and it is gone or under one
// unit of money; a token count, no cap or no read never warns.
import assert from "node:assert/strict";
import { balanceWarning } from "../../../packages/client/src/lib/connection-balance-warning.js";
import { runNamedCases } from "../fixtures/named-cases.js";

await runNamedCases([
  {
    name: "money under one unit is low, one or more is fine",
    run: () => {
      assert.equal(balanceWarning({ unit: "USD", left: 0.42 }), "low");
      assert.equal(balanceWarning({ unit: "CNY", left: 0.99 }), "low");
      assert.equal(balanceWarning({ unit: "USD", left: 1 }), null);
      assert.equal(balanceWarning({ unit: "USD", left: 556.44 }), null);
    },
  },
  {
    name: "nothing left warns for every unit",
    run: () => {
      assert.equal(balanceWarning({ unit: "USD", left: 0 }), "empty");
      assert.equal(balanceWarning({ unit: "USD", left: -3.5 }), "empty");
      assert.equal(balanceWarning({ unit: "TOKENS", left: 0 }), "empty");
    },
  },
  {
    name: "a non-money unit above zero never warns",
    run: () => {
      assert.equal(balanceWarning({ unit: "TOKENS", left: 0.5 }), null);
      assert.equal(balanceWarning({ unit: "TOKENS", left: 12 }), null);
    },
  },
  {
    name: "no cap, no read or a broken number never warns",
    run: () => {
      assert.equal(balanceWarning({ unit: "USD", left: null }), null);
      assert.equal(balanceWarning(null), null);
      assert.equal(balanceWarning(undefined), null);
      assert.equal(balanceWarning({ unit: "USD", left: Number.NaN }), null);
    },
  },
]);
