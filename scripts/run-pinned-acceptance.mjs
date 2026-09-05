import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const source = JSON.parse(readFileSync("contracts/source.json", "utf8"));
const temporary = mkdtempSync(join(tmpdir(), "hhm-platform-e2e-"));
const remote = `https://github.com/${source.owner}/${source.repository}.git`;

function run(command, args, cwd = temporary, timeout = 600_000) {
  console.log(`[acceptance] ${command} ${args.join(" ")}`);
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
  run("npm", ["test"]);

  run("rustfmt", [
    "--edition",
    "2021",
    "--check",
    "runtime/rust/src/lib.rs",
    "runtime/rust/tests/conformance.rs",
  ]);
  run("cargo", [
    "test",
    "--locked",
    "--manifest-path",
    "runtime/rust/Cargo.toml",
  ]);
  run("cargo", [
    "clippy",
    "--locked",
    "--manifest-path",
    "runtime/rust/Cargo.toml",
    "--all-targets",
    "--",
    "-D",
    "warnings",
  ]);

  const dartDirectory = join(temporary, "runtime/dart");
  run("dart", ["pub", "get", "--enforce-lockfile"], dartDirectory);
  run("dart", [
    "format",
    "--output=none",
    "--set-exit-if-changed",
    "lib/hhm_pub_lib_core.dart",
    "test",
  ], dartDirectory);
  run("dart", ["analyze", "--fatal-infos"], dartDirectory);
  run("dart", ["test"], dartDirectory);

  assert.equal(output("git", ["status", "--porcelain"]), "");
  console.log(`[acceptance] passed immutable source ${source.revision}`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

