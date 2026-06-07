import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path: string): string => readFileSync(path, "utf8");

test("coverage script generates a Cobertura report with c8", () => {
  const packageJson = JSON.parse(read("package.json")) as {
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  assert.match(packageJson.scripts?.["test:coverage"] ?? "", /\bc8\b/);
  assert.match(
    packageJson.scripts?.["test:coverage"] ?? "",
    /--reporter=cobertura/,
  );
  assert.ok(packageJson.devDependencies?.c8);
});

test("CI uploads coverage to GitHub Code Quality", () => {
  const workflow = read(".github/workflows/ci-release.yml");

  assert.match(workflow, /code-quality: write/);
  assert.match(workflow, /run: npm run test:coverage/);
  assert.match(workflow, /actions\/upload-code-coverage@v1/);
  assert.match(workflow, /file: coverage\/cobertura-coverage\.xml/);
  assert.match(workflow, /language: JavaScript/);
  assert.match(
    workflow,
    /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/,
  );
});

test("local coverage output is valid Cobertura XML when present", () => {
  const report = "coverage/cobertura-coverage.xml";
  if (!existsSync(report)) return;

  const xml = read(report);
  assert.match(xml, /<coverage\b/);
  assert.match(xml, /<sources>/);
  assert.match(xml, /<class name=/);
});
