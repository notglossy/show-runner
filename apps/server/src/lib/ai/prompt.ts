import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";
import type { ChatMessage } from "./client";

const RESPONSE_FORMAT = `

---

## Response format (for generated screens)

Reply with exactly one fenced code block with the language \`html\` containing the complete screen fragment
(the <style>, the markup, and the optional trailing <script>). Do not write anything before or after the code block.
When you are given an existing template, return the whole updated fragment, not a diff or excerpt.`;

let cachedDoc: { path: string; mtimeMs: number; text: string } | undefined;

/** docs/screen-authoring.md, re-read when the file changes. */
export function authoringDoc(): string {
  const file = env().AUTHORING_DOC_PATH ?? path.resolve(process.cwd(), "../../docs/screen-authoring.md");
  const { mtimeMs } = fs.statSync(file);
  if (!cachedDoc || cachedDoc.path !== file || cachedDoc.mtimeMs !== mtimeMs) {
    cachedDoc = { path: file, mtimeMs, text: fs.readFileSync(file, "utf8") };
  }
  return cachedDoc.text;
}

export function systemPrompt(doc = authoringDoc()): string {
  return doc + RESPONSE_FORMAT;
}

export function buildMessages({
  instruction,
  currentHtml,
  previewErrors,
  doc,
}: {
  instruction: string;
  currentHtml?: string | null;
  previewErrors?: string[];
  doc?: string;
}): ChatMessage[] {
  const system: ChatMessage = { role: "system", content: systemPrompt(doc) };
  if (!currentHtml?.trim()) {
    return [system, { role: "user", content: `Create a new screen.\n\n${instruction}` }];
  }
  const errors = previewErrors?.length
    ? `\nWhen previewed, it reported these JavaScript errors:\n${previewErrors.map((e) => `- ${e}`).join("\n")}\n`
    : "";
  return [
    system,
    {
      role: "user",
      content: `Here is the current screen template:\n\n\`\`\`html\n${currentHtml}\n\`\`\`\n${errors}\nChange it as follows:\n\n${instruction}`,
    },
  ];
}

export function repairMessage(problems: string[]): ChatMessage {
  return {
    role: "user",
    content: `That screen breaks these rules from the guide:\n${problems.map((p) => `- ${p}`).join("\n")}\n\nReturn the corrected complete fragment in one \`\`\`html code block.`,
  };
}
