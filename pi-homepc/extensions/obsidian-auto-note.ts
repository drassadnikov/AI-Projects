/**
 * Obsidian Auto-Note Extension
 *
 * After each settled agent run, appends a log block (prompt + result) to a
 * per-session note in the Obsidian vault:
 *   \\192.168.1.1\backup\Obsidian\Obsidian\pi-log\session-<id>.md
 *
 * The note header records session id, session file path (for restore/resume),
 * cwd and model, so a new session can be reconstructed without re-entering
 * the input data.
 *
 * Primary path: direct filesystem write to the vault share — works even when
 * the Obsidian app is NOT running. Fallback: the `obsidian` CLI (requires the
 * app to be running). Failures never break the session; they are reported via
 * a UI notification when available.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const VAULT = "\\\\192.168.1.1\\backup\\Obsidian\\Obsidian";
const FOLDER = "pi-log";
const PROMPT_MAX = 500;
const RESULT_MAX = 1500;

function lastTextOfRole(entries: any[], role: string): string {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.type !== "message" || e.message?.role !== role) continue;
    const c = e.message.content;
    if (Array.isArray(c)) {
      const text = c
        .filter((part: any) => part?.type === "text")
        .map((part: any) => part.text)
        .join("\n");
      if (text.trim()) return text;
    } else if (typeof c === "string" && c.trim()) {
      return c;
    }
  }
  return "";
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

export default function (pi: ExtensionAPI) {
  pi.on("agent_settled", async (_event, ctx) => {
    try {
      const entries = ctx.sessionManager.getEntries();
      const userText = lastTextOfRole(entries, "user");
      const assistantText = lastTextOfRole(entries, "assistant");
      if (!userText) return; // no real user prompt in this run

      const now = new Date();
      const time = now.toTimeString().slice(0, 8).replace(/:/g, "-"); // HH-MM-SS

      const sessionId = String(ctx.sessionManager.getSessionId?.() ?? "unknown");
      const safeId = sessionId.replace(/[^\w.-]/g, "-");
      const noteName = `session-${safeId}.md`;
      const notePath = join(VAULT, FOLDER, noteName);
      const vaultRelPath = `${FOLDER}/${noteName}`;

      const header = existsSync(notePath)
        ? undefined
        : [
            `# Session ${safeId}`,
            "",
            `- **Started:** ${now.toISOString()}`,
            `- **Session file:** ${ctx.sessionManager.getSessionFile?.() ?? "unknown"}`,
            `- **CWD:** ${ctx.cwd}`,
            `- **Model:** ${ctx.model?.id ?? "unknown"}`,
            "",
          ].join("\n");

      const block =
        [
          "",
          "---",
          "",
          `## ${time} Prompt`,
          "",
          truncate(userText, PROMPT_MAX),
          "",
          `## ${time} Result`,
          "",
          assistantText ? truncate(assistantText, RESULT_MAX) : "(no assistant reply)",
        ].join("\n") + "\n";
      const fullContent = (header ?? "") + block;

      let ok = false;
      let detail = "";

      // Primary: direct FS write to the vault share (no Obsidian app needed).
      try {
        mkdirSync(join(VAULT, FOLDER), { recursive: true });
        if (header) writeFileSync(notePath, fullContent);
        else appendFileSync(notePath, block);
        ok = true;
      } catch (err) {
        detail = (err as Error).message;
      }

      // Fallback: obsidian CLI (requires the app to be running).
      if (!ok) {
        const cmd = header ? "create" : "append";
        const r = spawnSync(
          "obsidian",
          [cmd, `path=${vaultRelPath}`, `content=${fullContent}`],
          { encoding: "utf8", timeout: 20_000, windowsHide: true },
        );
        if (r.status === 0) {
          ok = true;
        } else {
          detail =
            ((r.stderr || r.stdout || "") as string)
              .split("\n")
              .filter(Boolean)
              .join(" | ")
              .slice(0, 160) || `cli exit ${r.status ?? "?"}`;
        }
      }

      if (ok) {
        if (ctx.hasUI) ctx.ui.notify(`Obsidian note: ${vaultRelPath}`, "info");
      } else {
        if (ctx.hasUI) ctx.ui.notify(`Obsidian note failed: ${detail || "unknown error"}`, "warning");
      }
    } catch (err) {
      if (ctx.hasUI) ctx.ui.notify(`Obsidian auto-note error: ${(err as Error).message}`, "warning");
    }
  });
}
