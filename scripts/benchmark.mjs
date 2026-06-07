#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { spawn } from "node:child_process";
import {
  access,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";

const DEFAULT_ITERATIONS = 3;
const DEFAULT_WARMUP = 1;
const SOURCE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".mjs",
  ".ts",
  ".tsx",
]);

function parseArguments(argv) {
  const options = {
    source: null,
    output: null,
    iterations: DEFAULT_ITERATIONS,
    warmup: DEFAULT_WARMUP,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!key.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument near ${key}`);
    }

    if (key === "--source") options.source = resolve(value);
    else if (key === "--output") options.output = resolve(value);
    else if (key === "--iterations") options.iterations = Number(value);
    else if (key === "--warmup") options.warmup = Number(value);
    else throw new Error(`Unknown option: ${key}`);

    index += 1;
  }

  if (!options.source || !options.output) {
    throw new Error("--source and --output are required");
  }

  if (!Number.isInteger(options.iterations) || options.iterations < 1) {
    throw new Error("--iterations must be a positive integer");
  }

  if (!Number.isInteger(options.warmup) || options.warmup < 0) {
    throw new Error("--warmup must be a non-negative integer");
  }

  return options;
}

function run(command, args, cwd, { capture = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        CI: "true",
        FORCE_COLOR: "0",
      },
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";

    if (capture) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }

    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolvePromise(stdout.trim());
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed with ${
            signal ? `signal ${signal}` : `exit code ${code}`
          }${stdout ? `\n${stdout}` : ""}${stderr ? `\n${stderr}` : ""}`,
        ),
      );
    });
  });
}

function roundMilliseconds(value) {
  return Math.round(value * 100) / 100;
}

function summarize(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];

  return {
    unit: "milliseconds",
    samples: samples.map(roundMilliseconds),
    median: roundMilliseconds(median),
    min: roundMilliseconds(sorted[0]),
    max: roundMilliseconds(sorted.at(-1)),
  };
}

async function benchmark(name, command, args, cwd, iterations, warmup) {
  console.log(`\nBenchmarking ${name}`);

  for (let index = 0; index < warmup; index += 1) {
    console.log(`Warm-up ${index + 1}/${warmup}`);
    await run(command, args, cwd, { capture: true });
  }

  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    console.log(`Measured run ${index + 1}/${iterations}`);
    const startedAt = performance.now();
    await run(command, args, cwd, { capture: true });
    samples.push(performance.now() - startedAt);
  }

  return summarize(samples);
}

async function directoryMetrics(root, { sourceOnly = false } = {}) {
  let bytes = 0;
  let files = 0;

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (!sourceOnly || SOURCE_EXTENSIONS.has(extension(entry.name))) {
        const details = await stat(path);
        bytes += details.size;
        files += 1;
      }
    }
  }

  await visit(root);
  return { bytes, files };
}

async function largestFiles(root, limit = 10) {
  const files = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else {
        const details = await stat(path);
        files.push({
          path: relative(root, path),
          bytes: details.size,
        });
      }
    }
  }

  await visit(root);
  return files.sort((left, right) => right.bytes - left.bytes).slice(0, limit);
}

async function dependencyMetrics(source) {
  const packageJson = JSON.parse(
    await readFile(resolve(source, "package.json"), "utf8"),
  );
  const packageLock = JSON.parse(
    await readFile(resolve(source, "package-lock.json"), "utf8"),
  );
  const lockedPackages = Object.keys(packageLock.packages ?? {}).filter(
    Boolean,
  );

  return {
    directProduction: Object.keys(packageJson.dependencies ?? {}).length,
    directDevelopment: Object.keys(packageJson.devDependencies ?? {}).length,
    lockedPackages: lockedPackages.length,
  };
}

function extension(filename) {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot);
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function prepareSource(source) {
  const packageJson = resolve(source, "package.json");
  const packageLock = resolve(source, "package-lock.json");
  const requiredBinaries = [
    resolve(source, "node_modules", ".bin", "tsc"),
    resolve(source, "node_modules", ".bin", "electron-vite"),
  ];

  if (!(await pathExists(packageJson))) {
    throw new Error(`Browso package.json was not found in ${source}`);
  }

  const binariesExist = await Promise.all(requiredBinaries.map(pathExists));
  if (binariesExist.every(Boolean)) {
    return;
  }

  if (!(await pathExists(packageLock))) {
    throw new Error(
      `Browso dependencies are missing and package-lock.json was not found in ${source}`,
    );
  }

  console.log(
    "Browso dependencies are missing. Installing them with npm ci...",
  );
  await run("npm", ["ci"], source);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  await prepareSource(options.source);
  const sourceCommit =
    process.env.BROWSO_SHA ||
    (await run("git", ["rev-parse", "HEAD"], options.source, {
      capture: true,
    }));
  const packageVersion =
    process.env.BROWSO_VERSION ||
    (await run(
      "node",
      ["-p", "require('./package.json').version"],
      options.source,
      { capture: true },
    ));

  const metrics = {
    lint: await benchmark(
      "uncached linting",
      "npx",
      ["eslint", "--no-cache", "."],
      options.source,
      options.iterations,
      options.warmup,
    ),
    formatting: await benchmark(
      "format verification",
      "npx",
      ["prettier", "--check", "."],
      options.source,
      options.iterations,
      options.warmup,
    ),
    nodeTypecheck: await benchmark(
      "Node TypeScript type checking",
      "npx",
      ["tsc", "--noEmit", "-p", "tsconfig.node.json", "--composite", "false"],
      options.source,
      options.iterations,
      options.warmup,
    ),
    webTypecheck: await benchmark(
      "renderer TypeScript type checking",
      "npx",
      ["tsc", "--noEmit", "-p", "tsconfig.web.json", "--composite", "false"],
      options.source,
      options.iterations,
      options.warmup,
    ),
    tests: await benchmark(
      "automated tests",
      "npm",
      ["run", "test:smoke"],
      options.source,
      options.iterations,
      options.warmup,
    ),
    productionBuild: await benchmark(
      "production build",
      "npx",
      ["electron-vite", "build", "-c", "browso.vite.config.ts"],
      options.source,
      options.iterations,
      options.warmup,
    ),
  };

  const source = await directoryMetrics(resolve(options.source, "src"), {
    sourceOnly: true,
  });
  const outputRoot = resolve(options.source, "out");
  const bundle = await directoryMetrics(outputRoot);
  const sourceBreakdown = {
    main: await directoryMetrics(resolve(options.source, "src", "main"), {
      sourceOnly: true,
    }),
    preload: await directoryMetrics(resolve(options.source, "src", "preload"), {
      sourceOnly: true,
    }),
    renderer: await directoryMetrics(
      resolve(options.source, "src", "renderer"),
      { sourceOnly: true },
    ),
  };
  const bundleBreakdown = {
    main: await directoryMetrics(resolve(outputRoot, "main")),
    preload: await directoryMetrics(resolve(outputRoot, "preload")),
    renderer: await directoryMetrics(resolve(outputRoot, "renderer")),
  };
  const dependencies = await dependencyMetrics(options.source);
  const result = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    source: {
      repository: process.env.GITHUB_REPOSITORY || "Browso/browso",
      commit: sourceCommit,
      ref: process.env.BROWSO_REF || null,
      version: packageVersion,
      workflowRunId: process.env.BROWSO_WORKFLOW_RUN_ID || null,
      workflowRunUrl: process.env.BROWSO_WORKFLOW_RUN_URL || null,
    },
    environment: {
      runner: process.env.RUNNER_NAME || null,
      os: process.env.RUNNER_OS || platform(),
      osRelease: release(),
      architecture: process.env.RUNNER_ARCH || arch(),
      node: process.version,
      cpuCount: Number(process.env.RUNNER_CPU_COUNT) || cpus().length,
      totalMemoryBytes: totalmem(),
    },
    configuration: {
      iterations: options.iterations,
      warmupIterations: options.warmup,
    },
    metrics: {
      ...metrics,
      productionBundle: {
        unit: "bytes",
        value: bundle.bytes,
        files: bundle.files,
        breakdown: bundleBreakdown,
        largestFiles: await largestFiles(outputRoot),
      },
      sourceTree: {
        unit: "bytes",
        value: source.bytes,
        files: source.files,
        breakdown: sourceBreakdown,
      },
      dependencies,
    },
  };

  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`\nWrote benchmark results to ${options.output}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
