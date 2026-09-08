import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const source = JSON.parse(readFileSync("contracts/interfaces-source.json", "utf8"));
const temporary = mkdtempSync(join(tmpdir(), "hhm-interfaces-e2e-"));
const remote = `https://github.com/${source.owner}/${source.repository}.git`;

function run(command, args, cwd = temporary, timeout = 600_000) {
  console.log(`[interfaces-acceptance] ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    cwd,
    env: { ...process.env, CI: "1" },
    stdio: "inherit",
    timeout,
  });
}

function output(command, args, cwd = temporary) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
  }).trim();
}

function pythonWithTomllib() {
  for (const candidate of ["python3.12", "python3"]) {
    try {
      execFileSync(candidate, ["-c", "import tomllib"], { stdio: "ignore", timeout: 30_000 });
      return candidate;
    } catch {
      // Try the next explicit interpreter; repository verification requires Python 3.11+.
    }
  }
  throw new Error("Python with stdlib tomllib is required for interface acceptance");
}

try {
  run("git", ["init", "--quiet"]);
  run("git", ["remote", "add", "origin", remote]);
  run("git", ["fetch", "--quiet", "--depth=1", "origin", source.revision], temporary, 180_000);
  run("git", ["checkout", "--quiet", "--detach", "FETCH_HEAD"]);

  assert.equal(output("git", ["rev-parse", "HEAD"]), source.revision);
  assert.equal(output("git", ["remote", "get-url", "origin"]), remote);

  const packageDocument = JSON.parse(readFileSync(join(temporary, "package.json"), "utf8"));
  assert.equal(
    packageDocument.devDependencies["@oresoftware/ores-contracts"],
    `https://codeload.github.com/ORESoftware/ores-contracts/tar.gz/${source.generatorRevision}`,
  );

  run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
  run("npm", ["run", "check:platform"]);

  const receipt = JSON.parse(
    readFileSync(join(temporary, "target/ores-contracts/platform/receipt.json"), "utf8"),
  );
  assert.equal(receipt.status, "passed");
  assert.deepEqual(receipt.findings, []);
  assert.equal(receipt.authorities.typespec.sha256, source.typespecSha256);
  assert.equal(receipt.authorities["json-schema"].sha256, source.jsonSchemaSha256);
  assert.equal(receipt.authorities.typespec.models.length, source.modelCount);
  assert.equal(receipt.authorities.typespec.enums.length, source.enumCount);
  assert.ok(Object.values(receipt.artifacts).every((artifact) => artifact.byteParity === true));

  const python = pythonWithTomllib();
  run("npm", ["run", "verify:platform"]);
  run(python, ["scripts/check-generated-contract.py"]);
  run(python, ["scripts/verify_repo.py"]);
  run("cargo", ["fmt", "--all", "--", "--check"]);
  run("cargo", ["test", "--all-targets"]);
  run("cargo", ["check", "--locked", "--manifest-path", "tests/platform-rust-witness/Cargo.toml"]);

  assert.equal(output("git", ["status", "--porcelain"]), "");
  console.log(`[interfaces-acceptance] passed immutable source ${source.revision}`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
