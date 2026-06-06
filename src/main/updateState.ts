export interface UpdateSnapshot {
  checking: boolean;
  hasUpdate: boolean;
  dismissed: boolean;
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  releaseName: string | null;
  publishedAt: string | null;
  checkedAt: number | null;
  error: string | null;
}

export interface ReleaseMetadata {
  htmlUrl?: string;
  name?: string;
  publishedAt?: string;
  tagName?: string;
  draft?: boolean;
  prerelease?: boolean;
}

export function normalizeVersion(version: string | undefined): string | null {
  if (!version) {
    return null;
  }

  const match = version
    .trim()
    .match(/^v?(\d+(?:\.\d+){1,2}(?:-[0-9A-Za-z.-]+)?)$/i);
  return match?.[1] ?? null;
}

export function compareVersions(a: string, b: string): number {
  const aVersion = parseVersion(a);
  const bVersion = parseVersion(b);
  const length = Math.max(aVersion.core.length, bVersion.core.length);

  for (let index = 0; index < length; index += 1) {
    const aPart = aVersion.core[index] ?? 0;
    const bPart = bVersion.core[index] ?? 0;

    if (aPart > bPart) {
      return 1;
    }

    if (aPart < bPart) {
      return -1;
    }
  }

  if (aVersion.prerelease.length === 0 && bVersion.prerelease.length > 0) {
    return 1;
  }
  if (aVersion.prerelease.length > 0 && bVersion.prerelease.length === 0) {
    return -1;
  }

  const prereleaseLength = Math.max(
    aVersion.prerelease.length,
    bVersion.prerelease.length,
  );
  for (let index = 0; index < prereleaseLength; index += 1) {
    const aPart = aVersion.prerelease[index];
    const bPart = bVersion.prerelease[index];
    if (aPart === undefined) return -1;
    if (bPart === undefined) return 1;
    if (aPart === bPart) continue;

    const aNumber = /^\d+$/.test(aPart) ? Number(aPart) : null;
    const bNumber = /^\d+$/.test(bPart) ? Number(bPart) : null;
    if (aNumber !== null && bNumber !== null) {
      return aNumber > bNumber ? 1 : -1;
    }
    if (aNumber !== null) return -1;
    if (bNumber !== null) return 1;
    return aPart > bPart ? 1 : -1;
  }

  return 0;
}

export function selectLatestRelease(
  releases: ReleaseMetadata[],
  includePrereleases: boolean,
): ReleaseMetadata | null {
  return releases
    .filter((release) => !release.draft)
    .filter((release) => includePrereleases || !release.prerelease)
    .map((release) => ({
      release,
      version:
        normalizeVersion(release.tagName) ?? extractVersion(release.name),
    }))
    .filter(
      (
        candidate,
      ): candidate is { release: ReleaseMetadata; version: string } =>
        candidate.version !== null,
    )
    .sort((left, right) => compareVersions(right.version, left.version))[0]
    ?.release ?? null;
}

export function buildUpdateSnapshot(
  previousState: UpdateSnapshot,
  release: ReleaseMetadata,
  releasesUrl: string,
  checkedAt: number,
): Partial<UpdateSnapshot> {
  const latestVersion =
    normalizeVersion(release.tagName) ?? extractVersion(release.name);
  const hasUpdate =
    latestVersion !== null &&
    compareVersions(latestVersion, previousState.currentVersion) > 0;
  const dismissed =
    hasUpdate && previousState.latestVersion === latestVersion
      ? previousState.dismissed
      : false;

  return {
    checking: false,
    hasUpdate,
    dismissed,
    latestVersion,
    releaseUrl: release.htmlUrl || releasesUrl,
    releaseName: release.name || release.tagName || null,
    publishedAt: release.publishedAt || null,
    checkedAt,
    error: null,
  };
}

function extractVersion(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/\bv?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/i);
  return match?.[1] ?? null;
}

function parseVersion(version: string): {
  core: number[];
  prerelease: string[];
} {
  const [core, prerelease = ""] = version.replace(/^v/i, "").split("-", 2);
  return {
    core: core
      .split(".")
      .map((part) => Number.parseInt(part, 10))
      .filter((part) => Number.isFinite(part)),
    prerelease: prerelease ? prerelease.split(".") : [],
  };
}
