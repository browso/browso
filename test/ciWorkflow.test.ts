import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string): string => readFileSync(path, "utf8");

test("browso-ci keeps the requested stage order", () => {
  const workflow = read(".github/workflows/ci-release.yml");

  assert.match(workflow, /^name: browso-ci$/m);

  const stages = [
    "codeql",
    "codeql_advanced",
    "dependabot_update",
    "pages_build_deploy",
    "quality",
    "bootstrap",
    "testing",
    "release_plan",
    "package",
    "publish_release",
    "benchmarks",
  ];

  let previousIndex = -1;
  for (const stage of stages) {
    const index = workflow.indexOf(`\n  ${stage}:\n`);
    assert.ok(index >= 0, `missing ${stage} job`);
    assert.ok(
      index > previousIndex,
      `${stage} must appear after the prior stage`,
    );
    previousIndex = index;
  }
});
