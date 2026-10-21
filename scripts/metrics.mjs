import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function collectMetrics({
  lint,
  goEvents,
  goCoverage,
  webTests,
  webCoverage,
}) {
  const starts = goEvents.filter(
    (event) => event.Action === "run" && event.Test,
  );
  const leaves = goEvents.filter(
    (event) =>
      event.Test &&
      ["pass", "fail"].includes(event.Action) &&
      !starts.some(
        (child) =>
          child.Package === event.Package &&
          child.Test.startsWith(`${event.Test}/`),
      ),
  );
  const coverage = /total:\s+\(statements\)\s+([\d.]+)%/.exec(goCoverage);
  if (!coverage || !starts.length || webTests.numTotalTests === 0) {
    throw new Error("Incomplete test reports; metrics cannot be recorded");
  }
  const goSeconds = goEvents
    .filter((event) => !event.Test && ["pass", "fail"].includes(event.Action))
    .reduce((sum, event) => sum + event.Elapsed, 0);
  const webSeconds = webTests.testResults.reduce(
    (sum, suite) => sum + (suite.endTime - suite.startTime) / 1000,
    0,
  );
  return {
    eslint_errors: lint.reduce((sum, file) => sum + file.errorCount, 0),
    eslint_warnings: lint.reduce((sum, file) => sum + file.warningCount, 0),
    go_statement_coverage_pct: Number(coverage[1]),
    web_line_coverage_pct: webCoverage.total.lines.pct,
    web_branch_coverage_pct: webCoverage.total.branches.pct,
    tests_passed:
      leaves.filter((test) => test.Action === "pass").length +
      webTests.numPassedTests,
    tests_failed:
      leaves.filter((test) => test.Action === "fail").length +
      webTests.numFailedTests,
    test_execution_seconds: Number((goSeconds + webSeconds).toFixed(3)),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const json = (path) => JSON.parse(readFileSync(path, "utf8"));
  const stage =
    process.env.METRICS_STAGE ||
    /^stage\/(SGT-\d+)(?:\/|$)/.exec(process.env.GITHUB_REF_NAME || "")?.[1] ||
    null;
  if (
    stage &&
    ![
      "SGT-14",
      "SGT-15",
      "SGT-16",
      "SGT-17",
      "SGT-18",
      "SGT-19",
      "SGT-20",
    ].includes(stage)
  ) {
    throw new Error("Unknown development stage");
  }
  const metrics = collectMetrics({
    lint: json("artifacts/eslint.json"),
    goEvents: readFileSync("artifacts/go-tests.jsonl", "utf8")
      .trim()
      .split("\n")
      .map(JSON.parse),
    goCoverage: readFileSync("artifacts/go-coverage.txt", "utf8"),
    webTests: json("artifacts/web-tests.json"),
    webCoverage: json("artifacts/web-coverage/coverage-summary.json"),
  });
  const record = {
    recorded_at: new Date().toISOString(),
    stage,
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    run_url: process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null,
    metrics,
  };
  writeFileSync(
    "artifacts/metrics.json",
    `${JSON.stringify(record, null, 2)}\n`,
  );
  const markdown = `# Метрики качества\n\nЭтап: ${stage || "текущая проверка"}\n\nКоммит: ${record.commit}\n\n| Метрика | Значение |\n| --- | ---: |\n${Object.entries(
    metrics,
  )
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join("\n")}\n`;
  writeFileSync("artifacts/metrics.md", markdown);
  if (process.env.GITHUB_STEP_SUMMARY)
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, markdown, { flag: "a" });
  console.log(markdown);
}
