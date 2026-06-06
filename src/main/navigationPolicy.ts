import {
  BROWSO_WELCOME_URL,
  LEGACY_BLUEBERRY_WELCOME_URL,
} from "./WelcomePage.ts";

const ALLOWED_NAVIGATION_PROTOCOLS = new Set(["http:", "https:"]);
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function isAllowedNavigationTarget(value: string): boolean {
  if (
    value === BROWSO_WELCOME_URL ||
    value === LEGACY_BLUEBERRY_WELCOME_URL
  ) {
    return true;
  }

  return hasAllowedProtocol(value, ALLOWED_NAVIGATION_PROTOCOLS);
}

export function isAllowedExternalUrl(value: string): boolean {
  return hasAllowedProtocol(value, ALLOWED_EXTERNAL_PROTOCOLS);
}

export function normalizeHomepage(
  value: string | null | undefined,
  fallback: string,
): string {
  const candidate = value?.trim();
  return candidate && isAllowedNavigationTarget(candidate)
    ? candidate
    : fallback;
}

function hasAllowedProtocol(value: string, protocols: Set<string>): boolean {
  try {
    return protocols.has(new URL(value).protocol);
  } catch {
    return false;
  }
}
