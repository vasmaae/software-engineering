import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const run = (script, args = [], input = "") =>
  spawnSync("sh", [script, ...args], { cwd, input, encoding: "utf8" });

test("accepts main and task branches with the supported prefixes", () => {
  for (const branch of [
    "main",
    "feature/SGT-3-route-catalog",
    "bugfix/SGT-15-ci-checks",
    "docs/SGT-15-report",
    "chore/SGT-15-workflow-standards",
  ]) {
    const result = run("scripts/check-branch.sh", [branch]);
    assert.equal(result.status, 0, result.stderr);
  }
});

test("rejects missing task ids, unsupported prefixes and malformed descriptions", () => {
  for (const branch of [
    "",
    "sgt-15-rules",
    "task/SGT-15-rules",
    "feature/routes",
    "feature/sgt-15-rules",
    "feature/SGT-0-rules",
    "feature/SGT-15-",
    "feature/SGT-15-Rules",
    "feature/SGT-15-route_catalog",
    "feature/SGT-15-route--catalog",
    "feature/SGT-15-routes/extra",
    "feature/SGT-15-routes\ninvalid",
  ]) {
    const result = run("scripts/check-branch.sh", [branch]);
    assert.equal(result.status, 1, branch);
    assert.match(result.stderr, /Invalid branch:/);
  }
});

test("pre-push checks every remote destination, allowing tags and deletions", () => {
  const sha = "a".repeat(40);
  const zero = "0".repeat(40);
  const valid = `HEAD ${sha} refs/heads/feature/SGT-3-route-catalog ${zero}\n`;
  const invalid = `refs/heads/feature/SGT-3-route-catalog ${sha} refs/heads/invalid ${zero}\n`;
  assert.equal(run(".githooks/pre-push", [], valid).status, 0);
  assert.equal(run(".githooks/pre-push", [], invalid).status, 1);
  assert.equal(run(".githooks/pre-push", [], valid + invalid).status, 1);
  assert.equal(
    run(
      ".githooks/pre-push",
      [],
      `(delete) ${zero} refs/heads/invalid ${sha}\n`,
    ).status,
    0,
  );
  assert.equal(
    run(
      ".githooks/pre-push",
      [],
      `refs/tags/v0.1.1 ${sha} refs/tags/v0.1.1 ${zero}\n`,
    ).status,
    0,
  );
});
