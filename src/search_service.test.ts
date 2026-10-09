import assert from "node:assert/strict";
import { searchRequest } from "./search_service.js";

const parsed = searchRequest.parse({ query: "donor receipt", kind: "receipt" });
assert.equal(parsed.kind, "receipt");
assert.equal(parsed.limit, 3);
assert.throws(() => searchRequest.parse({ query: "" }));
console.log("request boundary test passed");
