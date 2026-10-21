import assert from "node:assert/strict";
import test from "node:test";
import { collectMetrics } from "./metrics.mjs";

const reports = {
  lint: [{ errorCount: 1, warningCount: 2 }],
  goEvents: [
    { Package: "api", Test: "TestRoutes", Action: "run" },
    { Package: "api", Test: "TestRoutes/valid", Action: "run" },
    { Package: "api", Test: "TestRoutes/valid", Action: "pass" },
    { Package: "api", Test: "TestRoutes/invalid", Action: "run" },
    { Package: "api", Test: "TestRoutes/invalid", Action: "fail" },
    { Package: "api", Test: "TestRoutes", Action: "fail" },
    { Package: "api", Action: "fail", Elapsed: 0.2 },
  ],
  goCoverage: "total: (statements) 83.3%",
  webTests: {
    numTotalTests: 3,
    numPassedTests: 2,
    numFailedTests: 1,
    testResults: [{ startTime: 1000, endTime: 1300 }],
  },
  webCoverage: { total: { lines: { pct: 90 }, branches: { pct: 80 } } },
};

test("counts leaf tests once and combines frontend and Go reports", () => {
  assert.deepEqual(collectMetrics(reports), {
    eslint_errors: 1,
    eslint_warnings: 2,
    go_statement_coverage_pct: 83.3,
    web_line_coverage_pct: 90,
    web_branch_coverage_pct: 80,
    tests_passed: 3,
    tests_failed: 2,
    test_execution_seconds: 0.5,
  });
});

test("rejects missing coverage rather than reporting a fake zero", () => {
  assert.throws(
    () => collectMetrics({ ...reports, goCoverage: "" }),
    /Incomplete/,
  );
});
