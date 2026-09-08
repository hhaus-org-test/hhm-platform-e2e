import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = JSON.parse(readFileSync("contracts/source.json", "utf8"));
const schema = JSON.parse(readFileSync("contracts/source.schema.json", "utf8"));
const interfacesSource = JSON.parse(readFileSync("contracts/interfaces-source.json", "utf8"));
const interfacesSchema = JSON.parse(readFileSync("contracts/interfaces-source.schema.json", "utf8"));
const shaPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^[0-9a-f]{64}$/;

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

test("interface source contract pins the production authority and its evidence", () => {
  assert.deepEqual(Object.keys(interfacesSource).sort(), interfacesSchema.required.toSorted());
  assert.equal(interfacesSource.schemaVersion, "hhaus-test.interfaces-source.v1");
  assert.equal(interfacesSource.owner, "hacker-house-medellin");
  assert.equal(interfacesSource.repository, "hhm-interfaces");
  assert.match(interfacesSource.revision, shaPattern);
  assert.match(interfacesSource.generatorRevision, shaPattern);
  assert.match(interfacesSource.typespecSha256, digestPattern);
  assert.match(interfacesSource.jsonSchemaSha256, digestPattern);
  assert.notEqual(interfacesSource.typespecSha256, interfacesSource.jsonSchemaSha256);
  assert.equal(interfacesSource.modelCount, 17);
  assert.equal(interfacesSource.enumCount, 20);
});

test("interface source contract never substitutes branch or tag names", () => {
  for (const value of [interfacesSource.revision, interfacesSource.generatorRevision]) {
    assert.doesNotMatch(value, /^(main|dev|latest|v\d)/);
  }
});
