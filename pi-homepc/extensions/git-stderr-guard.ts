/**
 * Git Stderr Guard (permanent, survives `pi update --extensions`)
 *
 * Problem: extensions (e.g. bigpowers/omp-hooks.ts `currentBranch()`) call
 * `child_process.execSync("git ...")` / `execFileSync("git ...")` without
 * setting `stdio`. Node's default for the sync functions is: stdout=pipe,
 * stderr=INHERIT. When git fails (e.g. "fatal: not a git repository (or any
 * of the parent directories): .git"), its stderr is written straight to the
 * terminal fd — and the TUI (differential rendering) leaves that raw line
 * visible in the middle of the screen.
 *
 * Fix: at module load time patch `child_process.execSync` / `execFileSync`
 * so that git commands without an explicit `stdio` get
 * `stdio: ["pipe", "pipe", "ignore"]` — stdout is still captured, stderr is
 * silenced. Commands with an explicit stdio (e.g. "inherit" for interactive
 * git) are left untouched. Non-git commands are not affected.
 *
 * Lives in the local package `pi-homepc` (path dependency in settings.json),
 * so `pi update --extensions` never overwrites it.
 *
 * IMPORTANT — load order (verified 2026-11-02):
 * pi loads each extension with `jiti.import()` (async ESM mode). An ESM
 * `import { execSync } from "node:child_process"` in another extension
 * snapshots the CJS exports of `node:child_process` at the moment of the
 * FIRST `import()` of that module. If any other extension (e.g. bigpowers)
 * is linked BEFORE this guard runs, its `execSync` binding keeps the
 * ORIGINAL function and the patch is invisible to it — the fatal lines
 * leak again. Therefore `A:\PROJECTS\pi-homepc` MUST stay the FIRST entry
 * of the `packages` array in C:\Users\HOME-PC\.pi\agent\settings.json.
 * The self-check below logs a warning to %TEMP%\pi-git-stderr-guard.log if
 * the order ever breaks, so the regression is diagnosable.
 */
import { createRequire } from "node:module";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function isGitCommand(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  return (
    t === "git" ||
    t === "git.exe" ||
    t.startsWith("git ") ||
    t.startsWith("git\t") ||
    t.endsWith("\\git") ||
    t.endsWith("\\git.exe") ||
    t.endsWith("/git") ||
    t.endsWith("/git.exe")
  );
}

// Use the CJS exports object (writable), not the frozen ESM namespace.
const require = createRequire(import.meta.url);
const cpAny = require("node:child_process") as Record<string, unknown>;

function patchSync(name: "execSync" | "execFileSync"): void {
  const orig = cpAny[name];
  if (typeof orig !== "function" || (orig as { __gitStderrGuard?: boolean }).__gitStderrGuard) {
    return;
  }
  const wrapped = function (this: unknown, command: string, options?: unknown) {
    if (isGitCommand(command)) {
      const opt =
        options !== null && typeof options === "object"
          ? (options as Record<string, unknown>)
          : undefined;
      if (opt && opt.stdio === undefined) {
        // Keep stdout piped (captured), silence stderr so git diagnostics
        // cannot leak into the TUI terminal.
        opt.stdio = ["pipe", "pipe", "ignore"];
        return (orig as (c: string, o?: unknown) => unknown).call(this, command, opt);
      }
    }
    return (orig as (c: string, o?: unknown) => unknown).call(this, command, options);
  };
  (wrapped as { __gitStderrGuard?: boolean }).__gitStderrGuard = true;
  cpAny[name] = wrapped;
}

// Install immediately on import — before any extension callback runs git.
patchSync("execSync");
patchSync("execFileSync");

// Self-check (async, never blocks startup): if the ESM namespace of
// node:child_process was already created before this guard ran, some
// extension snapshotted the ORIGINAL execSync and git stderr can leak.
// Write a warning to %TEMP%\pi-git-stderr-guard.log for diagnostics.
import("node:child_process")
  .then((ns) => {
    const ok = !!(ns.execSync as { __gitStderrGuard?: boolean } | undefined)?.__gitStderrGuard;
    if (ok) return;
    try {
      const { appendFileSync } = require("node:fs");
      const { tmpdir } = require("node:os");
      const { join } = require("node:path");
      appendFileSync(
        join(tmpdir(), "pi-git-stderr-guard.log"),
        `[${new Date().toISOString()}] WARNING: ESM namespace of node:child_process was ` +
          `snapshotted before git-stderr-guard loaded — git stderr may leak into the TUI. ` +
          `Fix: keep "A:\\PROJECTS\\pi-homepc" as the FIRST entry of the packages array ` +
          `in C:\\Users\\HOME-PC\\.pi\\agent\\settings.json.\n`
      );
    } catch {
      // Diagnostics must never break pi startup.
    }
  })
  .catch(() => {});

export default function (pi: ExtensionAPI): void {
  // No runtime hooks needed; the stdio guard is active process-wide.
  void pi;
}
