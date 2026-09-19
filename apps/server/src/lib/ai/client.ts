export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type ChatChunk = { type: 'content'; text: string } | { type: 'reasoning'; text: string };

export interface ChatResult {
  content: string;
  model: string | null;
  finishReason: string | null;
  usage: { promptTokens: number; completionTokens: number } | null;
}

/** Typed error for a failed AI provider call, carrying the HTTP `status`. */
export class AiProviderError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface ChatOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
  onChunk?: (chunk: ChatChunk) => void;
}

/**
 * Streams an OpenAI-compatible Chat Completions request (OpenRouter, OpenAI, Ollama, LM Studio, ...).
 * Only standard request fields are sent so any compatible server accepts it.
 */
export async function streamChat(options: ChatOptions): Promise<ChatResult> {
  const res = await fetch(`${options.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      'content-type': 'application/json',
      accept: 'text/event-stream',
      // OpenRouter attribution headers; ignored elsewhere.
      'x-title': 'ShowRunner',
      'http-referer': 'https://github.com/notglossy/show-runner',
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      stream: true,
      max_tokens: options.maxTokens ?? 32_000,
    }),
    signal: options.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    let message = text.slice(0, 500) || res.statusText;
    try {
      const body = JSON.parse(text);
      message = body?.error?.message ?? body?.message ?? message;
    } catch {
      // not JSON
    }
    throw new AiProviderError(res.status, `AI provider returned HTTP ${res.status}: ${message}`);
  }

  let content = '';
  let model: string | null = null;
  let finishReason: string | null = null;
  let usage: ChatResult['usage'] = null;

  const handle = (data: string) => {
    if (data === '[DONE]') return;
    let json: {
      model?: string;
      error?: { message?: string; code?: number };
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      choices?: {
        delta?: { content?: string | null; reasoning?: string | null };
        finish_reason?: string | null;
      }[];
    };
    try {
      json = JSON.parse(data);
    } catch {
      return;
    }
    if (json.error)
      throw new AiProviderError(
        json.error.code ?? 502,
        `AI provider error: ${json.error.message ?? 'unknown'}`,
      );
    model = json.model ?? model;
    if (json.usage)
      usage = {
        promptTokens: json.usage.prompt_tokens ?? 0,
        completionTokens: json.usage.completion_tokens ?? 0,
      };
    const choice = json.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    if (choice.delta?.reasoning)
      options.onChunk?.({ type: 'reasoning', text: choice.delta.reasoning });
    if (choice.delta?.content) {
      content += choice.delta.content;
      options.onChunk?.({ type: 'content', text: choice.delta.content });
    }
  };

  // Server-Sent Events: lines of "data: ...", blank line between events, ":" comments.
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
      if (line.startsWith('data:')) handle(line.slice(5).trimStart());
    }
  }
  if (buffer.startsWith('data:')) handle(buffer.slice(5).trimStart());

  return { content, model, finishReason, usage };
}
