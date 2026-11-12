/**
 * Obsidian Context Extension
 *
 * Adds a permanent system-prompt guideline: before answering ANY prompt,
 * the agent must first analyze the .md notes in the Obsidian vault
 * (vault: \\192.168.1.1\backup\Obsidian\Obsidian) using the `obsidian` tool
 * (files / search / read) and take their content into account.
 *
 * Personal extension — applies to every session and every prompt.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MARKER = "[obsidian-context]";

const GUIDELINE =
  MARKER +
  " Перед ответом на ЛЮБОЙ промпт сначала проанализируй md-заметки из Obsidian-хранилища " +
  "(vault: \\\\192.168.1.1\\backup\\Obsidian\\Obsidian): используй инструмент `obsidian` — " +
  "`files` для списка заметок, `search query=...` для поиска по теме текущего промпта, " +
  "`read file=...` для чтения релевантных заметок; затем учитывай их содержимое в ответе и плане действий. " +
  "Если Obsidian не запущен или инструмент не отвечает — кратко отметь это и продолжай работу без блокировки.";

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", (event) => {
    const guidelines = event.systemPromptOptions.promptGuidelines;
    if (!guidelines.some((g: string) => g.startsWith(MARKER))) {
      guidelines.push(GUIDELINE);
    }
  });
}
