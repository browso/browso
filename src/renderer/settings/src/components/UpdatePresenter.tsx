import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { ExternalLink, RotateCcw, Sparkles, X } from "lucide-react";

import { Button } from "@common/components/Button";
import { cn } from "@common/lib/utils";

type UpdateReleaseNote = {
  version: string;
  note: string | null;
};

type UpdateReleaseNotes = string | UpdateReleaseNote[] | null;

interface UpdatePresenterProps {
  open: boolean;
  latestVersion: string | null;
  releaseName: string | null;
  releaseNotes: UpdateReleaseNotes;
  onClose: () => void;
  onInstall: () => void;
  onOpenReleasePage: () => void;
}

const markdownComponents: Components = {
  p: ({ node, className, ...props }) => {
    void node;
    return (
      <p
        className={cn("text-sm leading-6 text-foreground/90", className)}
        {...props}
      />
    );
  },
  h1: ({ node, className, ...props }) => {
    void node;
    return (
      <h1
        className={cn(
          "text-base font-semibold tracking-tight text-foreground",
          className,
        )}
        {...props}
      />
    );
  },
  h2: ({ node, className, ...props }) => {
    void node;
    return (
      <h2
        className={cn(
          "text-base font-semibold tracking-tight text-foreground",
          className,
        )}
        {...props}
      />
    );
  },
  h3: ({ node, className, ...props }) => {
    void node;
    return (
      <h3
        className={cn(
          "text-sm font-semibold tracking-tight text-foreground",
          className,
        )}
        {...props}
      />
    );
  },
  ul: ({ node, className, ...props }) => {
    void node;
    return <ul className={cn("space-y-2 pl-5", className)} {...props} />;
  },
  ol: ({ node, className, ...props }) => {
    void node;
    return <ol className={cn("space-y-2 pl-5", className)} {...props} />;
  },
  li: ({ node, className, ...props }) => {
    void node;
    return (
      <li
        className={cn("text-sm leading-6 text-foreground/90", className)}
        {...props}
      />
    );
  },
  blockquote: ({ node, className, ...props }) => {
    void node;
    return (
      <blockquote
        className={cn(
          "border-l-2 border-border pl-4 text-sm leading-6 text-muted-foreground",
          className,
        )}
        {...props}
      />
    );
  },
  a: ({ node, className, ...props }) => {
    void node;
    return (
      <a
        className={cn(
          "font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground/70",
          className,
        )}
        target="_blank"
        rel="noreferrer"
        {...props}
      />
    );
  },
  strong: ({ node, className, ...props }) => {
    void node;
    return (
      <strong
        className={cn("font-semibold text-foreground", className)}
        {...props}
      />
    );
  },
  em: ({ node, className, ...props }) => {
    void node;
    return (
      <em className={cn("italic text-foreground/90", className)} {...props} />
    );
  },
  code: ({ node, className, ...props }) => {
    void node;
    return (
      <code
        className={cn(
          "rounded-md border border-border bg-secondary px-1.5 py-0.5 font-mono text-[0.8em] text-foreground",
          className,
        )}
        {...props}
      />
    );
  },
};

const renderMarkdown = (content: string): React.ReactNode => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm, remarkBreaks]}
    components={markdownComponents}
  >
    {content}
  </ReactMarkdown>
);

const renderReleaseNotes = (notes: UpdateReleaseNotes): React.ReactNode => {
  if (notes == null) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        No release notes were bundled with this update.
      </p>
    );
  }

  if (typeof notes === "string") {
    return (
      <div className="rounded-[24px] border border-border/70 bg-background/80 p-4">
        {renderMarkdown(notes)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((entry, index) => (
        <article
          key={`${entry.version}-${index}`}
          className="rounded-[24px] border border-border/70 bg-background/80 p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-border/70 bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-foreground">
              {entry.version}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
              {index === 0 ? "Newest changes" : "Earlier changes"}
            </span>
          </div>
          <div className="mt-3">
            {entry.note ? (
              renderMarkdown(entry.note)
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                No release notes were provided for this version.
              </p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
};

export const UpdatePresenter: React.FC<UpdatePresenterProps> = ({
  open,
  latestVersion,
  releaseName,
  releaseNotes,
  onClose,
  onInstall,
  onOpenReleasePage,
}) => {
  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !latestVersion) {
    return null;
  }

  const headline = releaseName || `v${latestVersion}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-[32px] border border-border/70 bg-card shadow-[0_35px_120px_rgba(15,23,42,0.28)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-presenter-title"
        aria-describedby="update-presenter-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.92),transparent_55%),linear-gradient(135deg,rgba(14,165,233,0.22),rgba(59,130,246,0.12),transparent_72%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_55%),linear-gradient(135deg,rgba(59,130,246,0.24),rgba(14,165,233,0.1),transparent_72%)]" />
        <div className="relative flex items-start justify-between gap-4 border-b border-border/70 px-6 pb-5 pt-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground shadow-sm">
              <Sparkles className="size-3.5" />
              Update downloaded
            </div>
            <h2
              id="update-presenter-title"
              className="mt-4 text-2xl font-semibold tracking-tight text-foreground"
            >
              What&apos;s new in {headline}
            </h2>
            <p
              id="update-presenter-description"
              className="mt-2 text-sm leading-6 text-muted-foreground"
            >
              The newest version is already on this machine. Review the
              highlights below, then restart when you&apos;re ready to install
              it.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close update presenter"
            className="inline-flex size-10 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="relative max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="rounded-[28px] border border-border/70 bg-background/75 p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              <span className="inline-flex items-center rounded-full border border-border/70 bg-secondary px-2.5 py-1 text-[10px] text-foreground">
                Ready to install
              </span>
              <span>Latest changes</span>
            </div>
            <div className="mt-4">{renderReleaseNotes(releaseNotes)}</div>
          </div>
        </div>

        <div className="relative flex flex-col gap-3 border-t border-border/70 bg-background/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted-foreground">
            The downloaded installer will replace the current app without
            removing your settings or data.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={onOpenReleasePage}>
              <ExternalLink className="size-4" />
              Open release page
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Maybe later
            </Button>
            <Button variant="default" size="sm" onClick={onInstall}>
              <RotateCcw className="size-4" />
              Restart and install
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
