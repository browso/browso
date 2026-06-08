import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string): string => readFileSync(path, "utf8");

test("package exposes the benchmark runner", () => {
  const packageJson = JSON.parse(read("package.json")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.benchmark,
    "node scripts/benchmark.mjs --source . --output benchmark-results/browso.json",
  );
});

test("CI runs benchmarks only after validation and release jobs finish", () => {
  const workflow = read(".github/workflows/ci-release.yml");
  const benchmarkJob = workflow.slice(workflow.indexOf("  benchmarks:"));

  assert.match(workflow, /^\s{2}benchmarks:$/m);
  assert.match(workflow, /run: npm run benchmark/);
  assert.match(workflow, /path: benchmark-results\/browso\.json/);
  assert.match(workflow, /retention-days: 30/);
  for (const dependency of [
    "security",
    "quality",
    "build",
    "test",
    "release_plan",
    "package_macos",
    "package_windows",
    "package_linux",
    "attest_build_provenance",
    "publish_release",
  ]) {
    assert.match(benchmarkJob, new RegExp(`- ${dependency}`), dependency);
  }
  assert.match(benchmarkJob, /needs\.security\.result == 'success'/);
  assert.match(
    benchmarkJob,
    /needs\.package_macos\.result == 'success' \|\| needs\.package_macos\.result == 'skipped'/,
  );
  assert.match(
    benchmarkJob,
    /needs\.package_windows\.result == 'success' \|\| needs\.package_windows\.result == 'skipped'/,
  );
  assert.match(
    benchmarkJob,
    /needs\.package_linux\.result == 'success' \|\| needs\.package_linux\.result == 'skipped'/,
  );
  assert.match(
    benchmarkJob,
    /needs\.attest_build_provenance\.result == 'success' \|\| needs\.attest_build_provenance\.result == 'skipped'/,
  );
  assert.match(
    benchmarkJob,
    /needs\.publish_release\.result == 'success' \|\| needs\.publish_release\.result == 'skipped'/,
  );
  assert.doesNotMatch(workflow, /BENCHMARKS_DISPATCH_TOKEN/);
  assert.doesNotMatch(workflow, /Browso\/benchmarks/);
  assert.match(workflow, /WEBSITE_DISPATCH_TOKEN/);
  assert.match(workflow, /Browso\/browso\.github\.io\/dispatches/);
  assert.match(workflow, /browso-benchmarks-updated/);
  assert.match(workflow, /repository: "browso\/browso"/);
});

test("benchmark runner records quality, compilation, test, and size metrics", () => {
  const source = read("scripts/benchmark.mjs");

  assert.match(source, /schemaVersion: 2/);
  assert.match(source, /lint: await benchmark/);
  assert.match(source, /formatting: await benchmark/);
  assert.match(source, /nodeTypecheck: await benchmark/);
  assert.match(source, /webTypecheck: await benchmark/);
  assert.match(source, /tests: await benchmark/);
  assert.match(source, /productionBuild: await benchmark/);
  assert.match(source, /productionBundle:/);
  assert.match(source, /sourceTree:/);
  assert.match(source, /largestFiles:/);
  assert.match(source, /dependencies,/);
});
