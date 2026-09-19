import type { GenerateScreenRequest } from '@/lib/api/types';

import { type ChatMessage, type ChatResult, streamChat } from './client';
import { extractHtml } from './extract';
import { buildMessages, repairMessage } from './prompt';
import { validateTemplate } from './validate';

export type GenerateEvent =
  | { type: 'status'; message: string }
  | { type: 'progress'; phase: 'reasoning' | 'writing'; characters: number }
  | {
      type: 'result';
      html: string;
      problems: string[];
      model: string;
      attempts: number;
      usage: ChatResult['usage'];
    }
  | { type: 'error'; message: string };

export interface GenerateConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxRepairs?: number;
}

type Chat = typeof streamChat;

/**
 * Generates (or revises) a screen: one model call, validation, and up to `maxRepairs` repair turns.
 * Emits progress events; the final event is `result` or `error`.
 */
export async function generateScreen(
  request: GenerateScreenRequest,
  config: GenerateConfig,
  emit: (event: GenerateEvent) => void,
  { signal, chat = streamChat, doc }: { signal?: AbortSignal; chat?: Chat; doc?: string } = {},
): Promise<void> {
  const messages: ChatMessage[] = buildMessages({ ...request, doc });
  const model = request.model ?? config.model;
  const maxRepairs = config.maxRepairs ?? 1;
  let usage: ChatResult['usage'] = null;

  for (let attempt = 1; attempt <= maxRepairs + 1; attempt++) {
    emit({
      type: 'status',
      message:
        attempt === 1
          ? `Asking ${model}…`
          : `Fixing ${attempt === 2 ? 'problems' : 'remaining problems'} (attempt ${attempt})…`,
    });
    let written = 0;
    let reasoned = 0;
    let lastEmit = 0;
    const reply = await chat({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model,
      messages,
      signal,
      onChunk: (chunk) => {
        if (chunk.type === 'content') written += chunk.text.length;
        else reasoned += chunk.text.length;
        const now = Date.now();
        if (now - lastEmit > 250) {
          lastEmit = now;
          emit({
            type: 'progress',
            phase: written ? 'writing' : 'reasoning',
            characters: written || reasoned,
          });
        }
      },
    });
    usage = addUsage(usage, reply.usage);

    const html = extractHtml(reply.content);
    const problems =
      html === null
        ? ['The reply did not contain an ```html code block with the screen.']
        : validateTemplate(html);
    if (reply.finishReason === 'length')
      problems.push('The reply was cut off (output token limit); keep the template more compact.');

    if (problems.length === 0 || attempt === maxRepairs + 1) {
      if (html === null) {
        emit({
          type: 'error',
          message: `The model didn't return a screen. Reply started: ${reply.content.slice(0, 200) || '(empty)'}`,
        });
      } else {
        emit({
          type: 'result',
          html,
          problems,
          model: reply.model ?? model,
          attempts: attempt,
          usage,
        });
      }
      return;
    }
    messages.push({ role: 'assistant', content: reply.content }, repairMessage(problems));
  }
}

function addUsage(total: ChatResult['usage'], next: ChatResult['usage']): ChatResult['usage'] {
  if (!next) return total;
  return {
    promptTokens: (total?.promptTokens ?? 0) + next.promptTokens,
    completionTokens: (total?.completionTokens ?? 0) + next.completionTokens,
  };
}
