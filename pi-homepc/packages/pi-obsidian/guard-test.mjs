// Smoke test for the vendored pi-obsidian vault guard (HOME-PC patch).
// Uses jiti to load the TS extension (pi's loader resolves extensionless imports too).
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
const mod = await jiti.import("A:/PROJECTS/pi-homepc/packages/pi-obsidian/extensions/index.ts");
const { isVaultFilesystemBashCommand } = mod;

const cwd = "A:/PROJECTS";
const root = "K:/Obsidian/Obsidian";

const cases = [
  // The exact command from the screenshot (was blocked):
  ['ls -lah "C:/Users/HOME-PC/.pi/agent/sessions/"; echo "===MEMORIES==="; du -sh "K:/Obsidian/Obsidian/pi-log" 2>/dev/null; ls "K:/Obsidian/Obsidian/pi-log" 2>/dev/null | wc -l', false],
  // Read-only single commands on the vault — now allowed:
  ['du -sh "K:/Obsidian/Obsidian/pi-log"', false],
  ['cat "K:/Obsidian/Obsidian/Results/note.md"', false],
  ['grep -r foo "K:/Obsidian/Obsidian"', false],
  ['head -5 "K:/Obsidian/Obsidian/n.md"', false],
  ['find "K:/Obsidian/Obsidian" -name "*.md"', false],
  // Non-vault commands — allowed:
  ['ls C:/temp', false],
  ['echo hello', false],
  // Writes to the vault — still blocked:
  ['rm "K:/Obsidian/Obsidian/Results/note.md"', true],
  ['mv a.md "K:/Obsidian/Obsidian/Results/"', true],
  ['cp a.md "K:/Obsidian/Obsidian/n.md"', true],
  ['echo hi > "K:/Obsidian/Obsidian/x.md"', true],
  ['mkdir -p "K:/Obsidian/Obsidian/pi-log"', true],
  ['sed -i "s/a/b/" "K:/Obsidian/Obsidian/n.md"', true],
  ['tee "K:/Obsidian/Obsidian/n.md" < a.txt', true],
  // Unknown command touching the vault — blocked (conservative):
  ['someUnknownTool "K:/Obsidian/Obsidian/x"', true],
  // Compound with one write segment — blocked:
  ['ls C:/temp; rm "K:/Obsidian/Obsidian/n.md"', true],
  // Quoted separator must not split:
  ['echo "a;b" > /tmp/x', false],
];

let fail = 0;
for (const [cmd, expected] of cases) {
  const got = isVaultFilesystemBashCommand(cmd, cwd, root);
  const ok = got === expected;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  expected=${expected} got=${got}  ${cmd.slice(0, 70)}`);
}
console.log(fail === 0 ? "ALL PASS" : `${fail} FAILURES`);
process.exit(fail ? 1 : 0);
