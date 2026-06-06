import { app } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export interface BrowserProfile {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface BrowserContext {
  id: string;
  profileId: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProfileContextState {
  activeProfileId: string;
  activeContextId: string;
  profiles: BrowserProfile[];
  contexts: BrowserContext[];
}

interface ProfileContextFile extends ProfileContextState {
  version: 1;
}

const DEFAULT_PROFILE_ID = "profile-default";
const DEFAULT_CONTEXT_ID = "context-default";

export class ProfileContextStore {
  private static instance: ProfileContextStore | null = null;
  private readonly filePath: string;
  private state: ProfileContextState;

  private constructor() {
    this.filePath = join(app.getPath("userData"), "profiles-and-contexts.json");
    this.state = this.load();
  }

  static getInstance(): ProfileContextStore {
    if (!ProfileContextStore.instance) {
      ProfileContextStore.instance = new ProfileContextStore();
    }
    return ProfileContextStore.instance;
  }

  getState(): ProfileContextState {
    return {
      activeProfileId: this.state.activeProfileId,
      activeContextId: this.state.activeContextId,
      profiles: this.state.profiles.map((profile) => ({ ...profile })),
      contexts: this.state.contexts.map((context) => ({ ...context })),
    };
  }

  getActiveContextId(): string {
    return this.state.activeContextId;
  }

  getActiveSelection(): {
    profile: BrowserProfile;
    context: BrowserContext;
  } {
    return {
      profile: { ...this.requireProfile(this.state.activeProfileId) },
      context: { ...this.requireContext(this.state.activeContextId) },
    };
  }

  createProfile(name: string): ProfileContextState {
    const now = Date.now();
    const profileId = this.createId("profile");
    const contextId = this.createId("context");
    this.state.profiles.push({
      id: profileId,
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
    });
    this.state.contexts.push({
      id: contextId,
      profileId,
      name: "General",
      description: "",
      createdAt: now,
      updatedAt: now,
    });
    this.state.activeProfileId = profileId;
    this.state.activeContextId = contextId;
    this.persist();
    return this.getState();
  }

  renameProfile(id: string, name: string): ProfileContextState {
    const profile = this.requireProfile(id);
    profile.name = name.trim();
    profile.updatedAt = Date.now();
    this.persist();
    return this.getState();
  }

  deleteProfile(id: string): ProfileContextState {
    if (this.state.profiles.length === 1) {
      throw new Error("At least one profile is required.");
    }
    this.requireProfile(id);
    this.state.profiles = this.state.profiles.filter(
      (profile) => profile.id !== id,
    );
    this.state.contexts = this.state.contexts.filter(
      (context) => context.profileId !== id,
    );

    if (this.state.activeProfileId === id) {
      const nextProfile = this.state.profiles[0];
      const nextContext = this.state.contexts.find(
        (context) => context.profileId === nextProfile.id,
      );
      if (!nextContext) {
        throw new Error("The next profile has no context.");
      }
      this.state.activeProfileId = nextProfile.id;
      this.state.activeContextId = nextContext.id;
    }

    this.persist();
    return this.getState();
  }

  switchProfile(id: string): ProfileContextState {
    const profile = this.requireProfile(id);
    const contexts = this.state.contexts
      .filter((context) => context.profileId === id)
      .sort((left, right) => right.updatedAt - left.updatedAt);
    const context = contexts[0];
    if (!context) {
      throw new Error("The selected profile has no context.");
    }
    profile.updatedAt = Date.now();
    this.state.activeProfileId = id;
    this.state.activeContextId = context.id;
    this.persist();
    return this.getState();
  }

  createContext(
    profileId: string,
    name: string,
    description = "",
  ): ProfileContextState {
    const profile = this.requireProfile(profileId);
    const now = Date.now();
    const context: BrowserContext = {
      id: this.createId("context"),
      profileId,
      name: name.trim(),
      description: description.trim(),
      createdAt: now,
      updatedAt: now,
    };
    this.state.contexts.push(context);
    profile.updatedAt = now;
    this.state.activeProfileId = profileId;
    this.state.activeContextId = context.id;
    this.persist();
    return this.getState();
  }

  updateContext(
    id: string,
    input: { name?: string; description?: string },
  ): ProfileContextState {
    const context = this.requireContext(id);
    if (typeof input.name === "string") {
      context.name = input.name.trim();
    }
    if (typeof input.description === "string") {
      context.description = input.description.trim();
    }
    context.updatedAt = Date.now();
    this.persist();
    return this.getState();
  }

  deleteContext(id: string): ProfileContextState {
    const context = this.requireContext(id);
    const profileContexts = this.state.contexts.filter(
      (entry) => entry.profileId === context.profileId,
    );
    if (profileContexts.length === 1) {
      throw new Error("Each profile must keep at least one context.");
    }
    this.state.contexts = this.state.contexts.filter(
      (entry) => entry.id !== id,
    );

    if (this.state.activeContextId === id) {
      const nextContext = this.state.contexts.find(
        (entry) => entry.profileId === context.profileId,
      );
      if (!nextContext) {
        throw new Error("The active profile has no remaining context.");
      }
      this.state.activeContextId = nextContext.id;
    }

    this.persist();
    return this.getState();
  }

  switchContext(id: string): ProfileContextState {
    const context = this.requireContext(id);
    const profile = this.requireProfile(context.profileId);
    const now = Date.now();
    context.updatedAt = now;
    profile.updatedAt = now;
    this.state.activeProfileId = context.profileId;
    this.state.activeContextId = id;
    this.persist();
    return this.getState();
  }

  private load(): ProfileContextState {
    const fallback = this.buildDefaults();
    try {
      const parsed = JSON.parse(
        readFileSync(this.filePath, "utf8"),
      ) as Partial<ProfileContextFile>;
      if (
        parsed.version !== 1 ||
        !Array.isArray(parsed.profiles) ||
        !Array.isArray(parsed.contexts) ||
        parsed.profiles.length === 0 ||
        parsed.contexts.length === 0 ||
        typeof parsed.activeProfileId !== "string" ||
        typeof parsed.activeContextId !== "string"
      ) {
        return fallback;
      }
      const activeProfile = parsed.profiles.find(
        (profile) => profile.id === parsed.activeProfileId,
      );
      const activeContext = parsed.contexts.find(
        (context) =>
          context.id === parsed.activeContextId &&
          context.profileId === parsed.activeProfileId,
      );
      return activeProfile && activeContext
        ? {
            activeProfileId: parsed.activeProfileId,
            activeContextId: parsed.activeContextId,
            profiles: parsed.profiles,
            contexts: parsed.contexts,
          }
        : fallback;
    } catch {
      return fallback;
    }
  }

  private buildDefaults(): ProfileContextState {
    const now = Date.now();
    return {
      activeProfileId: DEFAULT_PROFILE_ID,
      activeContextId: DEFAULT_CONTEXT_ID,
      profiles: [
        {
          id: DEFAULT_PROFILE_ID,
          name: "Personal",
          createdAt: now,
          updatedAt: now,
        },
      ],
      contexts: [
        {
          id: DEFAULT_CONTEXT_ID,
          profileId: DEFAULT_PROFILE_ID,
          name: "General",
          description: "Default browsing and AI context",
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
  }

  private requireProfile(id: string): BrowserProfile {
    const profile = this.state.profiles.find((entry) => entry.id === id);
    if (!profile) {
      throw new Error("Profile not found.");
    }
    return profile;
  }

  private requireContext(id: string): BrowserContext {
    const context = this.state.contexts.find((entry) => entry.id === id);
    if (!context) {
      throw new Error("Context not found.");
    }
    return context;
  }

  private createId(prefix: "profile" | "context"): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  private persist(): void {
    const file: ProfileContextFile = {
      version: 1,
      ...this.state,
    };
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(file, null, 2), "utf8");
  }
}
