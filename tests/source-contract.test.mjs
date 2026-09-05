import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = JSON.parse(readFileSync("contracts/source.json", "utf8"));
const schema = JSON.parse(readFileSync("contracts/source.schema.json", "utf8"));
const shaPattern = /^[0-9a-f]{40}$/;

test("source contract is closed and pins immutable identities", () => {
  assert.deepEqual(Object.keys(source).sort(), schema.required.toSorted());
  assert.equal(source.schemaVersion, "hhaus-test.source.v1");
  assert.equal(source.owner, "hacker-house-medellin");
  assert.equal(source.repository, "hhm-pub-lib-core");
  assert.match(source.revision, shaPattern);
  assert.match(source.generatorRevision, shaPattern);
});

test("source contract never substitutes branch or tag names", () => {
  for (const value of [source.revision, source.generatorRevision]) {
    assert.doesNotMatch(value, /^(main|dev|latest|v\d)/);
  }
});

