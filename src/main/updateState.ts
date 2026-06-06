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
  const aParts = parseVersion(a);
  const bParts = parseVersion(b);
  const length = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < length; index += 1) {
    const aPart = aParts[index] ?? 0;
    const bPart = bParts[index] ?? 0;

    if (aPart > bPart) {
      return 1;
    }

    if (aPart < bPart) {
      return -1;
    }
  }

  return 0;
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

function parseVersion(version: string): number[] {
  return version
    .split("-")[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}
