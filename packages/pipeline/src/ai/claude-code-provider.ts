import { spawn } from "node:child_process";
import type { AIProvider, AIGenerateOpts, AIGenerateResult } from "../types.js";

interface ClaudeCodeConfig {
  model?: string;
}

/**
 * AI provider that spawns the Claude Code CLI.
 *
 *   claude --print --output-format stream-json --verbose \
 *     --system-prompt <prompt> [--model <model>] [--resume <sessionId>] \
 *     <userMessage>
 */
export class ClaudeCodeProvider implements AIProvider {
  readonly id = "claude-code";
  readonly name = "Claude Code CLI";

  private config: ClaudeCodeConfig;

  constructor(config: ClaudeCodeConfig = {}) {
    this.config = config;
  }

  async generate(opts: AIGenerateOpts): Promise<AIGenerateResult> {
    const args = [
      "--print",
      "--output-format", "stream-json",
      "--verbose",
      "--system-prompt", opts.systemPrompt,
    ];

    if (this.config.model) args.push("--model", this.config.model);
    if (opts.sessionId) args.push("--resume", opts.sessionId);

    args.push(opts.userMessage);

    return new Promise<AIGenerateResult>((resolve, reject) => {
      const proc = spawn("claude", args, {
        cwd: opts.cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let buffer = "";
      let capturedSessionId: string | null = opts.sessionId ?? null;
      let accumulatedText = "";

      proc.stdout.on("data", (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            const captured = this.handleStreamEvent(event, opts.onProgress);
            if (captured.sessionId) capturedSessionId = captured.sessionId;
            if (captured.text) accumulatedText += captured.text;
          } catch {
            // Non-JSON line
          }
        }
      });

      let stderr = "";
      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve({ sessionId: capturedSessionId, text: accumulatedText });
        } else {
          reject(new Error(`Claude Code exited with code ${code}: ${stderr}`));
        }
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to spawn Claude Code: ${err.message}`));
      });
    });
  }

  private handleStreamEvent(
    event: Record<string, any>,
    onProgress: AIGenerateOpts["onProgress"],
  ): { sessionId?: string; text?: string } {
    if (event.type === "system" && event.subtype === "init" && event.session_id) {
      return { sessionId: event.session_id };
    }

    if (event.type === "assistant" && event.message?.content) {
      let text = "";
      for (const block of event.message.content) {
        if (block.type === "text") {
          onProgress({ type: "text", content: block.text });
          text += block.text;
        } else if (block.type === "tool_use") {
          onProgress({
            type: "tool_use",
            content: `${block.name}: ${JSON.stringify(block.input?.file_path ?? block.input?.command ?? "").slice(0, 100)}`,
          });
        }
      }
      return text ? { text } : {};
    }

    if (event.type === "result") {
      onProgress({ type: "complete", content: "Generation complete" });
    }
    return {};
  }
}
