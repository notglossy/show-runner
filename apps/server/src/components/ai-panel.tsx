'use client';

import { useEffect, useRef, useState } from 'react';
import type { GenerateEvent } from '@/lib/ai/generate';
import { api, ApiClientError } from '@/lib/client/api';
import { Badge, Button, Card, ErrorText, inputBase, inputClass } from './ui';

interface AiConfig {
  configured: boolean;
  defaultModel: string;
  provider: string;
  models: string[];
}

const MODEL_KEY = 'showrunner.aiModel';

function readStoredModel(): string | null {
  try {
    return window.localStorage.getItem(MODEL_KEY);
  } catch {
    return null;
  }
}

export interface AiResult {
  html: string;
  instruction: string;
  model: string;
  problems: string[];
}

/** "Generate with AI" panel for the screen editor. */
export function AiPanel({
  currentHtml,
  hasExistingScreen,
  previewErrors,
  onResult,
}: {
  currentHtml: string;
  hasExistingScreen: boolean;
  previewErrors: string[];
  onResult: (result: AiResult) => void;
}) {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [instruction, setInstruction] = useState('');
  const [basedOnCurrent, setBasedOnCurrent] = useState(hasExistingScreen);
  const [includeErrors, setIncludeErrors] = useState(true);
  const [model, setModel] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const abort = useRef<AbortController | null>(null);

  // Tick the elapsed-time counter while a generation runs (models can think silently for a while).
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    let cancelled = false;
    api<AiConfig>('/api/ai/config')
      .then((c) => {
        if (cancelled) return;
        setConfig(c);
        setModel(readStoredModel() ?? c.defaultModel);
      })
      .catch(
        (err) => !cancelled && setError(err instanceof ApiClientError ? err.detail : String(err)),
      );
    return () => {
      cancelled = true;
      abort.current?.abort();
    };
  }, []);

  function rememberModel(value: string) {
    setModel(value);
    try {
      if (value && value !== config?.defaultModel) window.localStorage.setItem(MODEL_KEY, value);
      else window.localStorage.removeItem(MODEL_KEY);
    } catch {
      // storage unavailable
    }
  }

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    setError(null);
    setProblems([]);
    setStatus(null);
    setPhase('Starting…');
    const started = Date.now();
    setStartedAt(started);
    setNow(started);
    try {
      const res = await fetch('/api/ai/generate-screen', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          instruction,
          currentHtml: basedOnCurrent ? currentHtml : null,
          model: model.trim() || undefined,
          previewErrors:
            basedOnCurrent && includeErrors && previewErrors.length
              ? previewErrors.slice(0, 20).map((e) => e.slice(0, 1000))
              : undefined,
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as GenerateEvent;
          const secs = Math.round((Date.now() - started) / 1000);
          if (ev.type === 'status') setPhase(ev.message);
          else if (ev.type === 'progress')
            setPhase(
              `${ev.phase === 'reasoning' ? 'Thinking' : 'Writing'}… ${(ev.characters / 1024).toFixed(1)} KB`,
            );
          else if (ev.type === 'error') {
            finished = true;
            setError(ev.message);
            setStatus(null);
          } else if (ev.type === 'result') {
            finished = true;
            setProblems(ev.problems);
            const tokens = ev.usage
              ? ` · ${ev.usage.promptTokens.toLocaleString()} in / ${ev.usage.completionTokens.toLocaleString()} out tokens`
              : '';
            setStatus(
              `Done in ${secs}s with ${ev.model}${ev.attempts > 1 ? ` (${ev.attempts} attempts)` : ''}${tokens}. Review the preview, then Save.`,
            );
            onResult({ html: ev.html, instruction, model: ev.model, problems: ev.problems });
            setBasedOnCurrent(true);
            setInstruction('');
          }
        }
      }
      if (!finished) throw new Error('The generation stream ended unexpectedly.');
    } catch (err) {
      if (controller.signal.aborted) setStatus('Stopped.');
      else {
        setError(err instanceof Error ? err.message : String(err));
        setStatus(null);
      }
    } finally {
      setRunning(false);
      setPhase(null);
      abort.current = null;
    }
  }

  if (config && !config.configured) {
    return (
      <Card title="Generate with AI">
        <p className="text-sm text-neutral-600">
          AI generation is off. Set <code>AI_API_KEY</code> (and optionally <code>AI_BASE_URL</code>
          , <code>AI_MODEL</code>) on the server to enable it.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Generate with AI"
      actions={config && <span className="text-xs text-neutral-500">{config.provider}</span>}
    >
      <form onSubmit={generate} className="flex flex-col gap-3">
        <textarea
          className={`${inputClass} min-h-24 resize-y`}
          placeholder={
            basedOnCurrent
              ? 'What should change? e.g. make the clock bigger and move the forecast to the left'
              : "Describe the screen, e.g. a big analog clock with today's high and low and sunrise/sunset"
          }
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && instruction.trim() && !running)
              void generate(e);
          }}
          disabled={running}
          required
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-700">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={basedOnCurrent}
              onChange={(e) => setBasedOnCurrent(e.target.checked)}
              disabled={running}
            />
            Based on current screen
          </label>
          {basedOnCurrent && previewErrors.length > 0 && (
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={includeErrors}
                onChange={(e) => setIncludeErrors(e.target.checked)}
                disabled={running}
              />
              Include {previewErrors.length} preview error{previewErrors.length === 1 ? '' : 's'}
            </label>
          )}
          <label className="flex min-w-64 flex-1 items-center gap-1.5">
            <span className="text-xs text-neutral-500">Model</span>
            <input
              className={`${inputBase} flex-1 font-mono text-xs`}
              list="ai-models"
              value={model}
              onChange={(e) => rememberModel(e.target.value)}
              disabled={running}
            />
            <datalist id="ai-models">
              {config?.models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant="primary"
            disabled={running || !instruction.trim() || !config}
          >
            {running ? 'Generating…' : basedOnCurrent ? 'Revise' : 'Generate'}
          </Button>
          {running && (
            <Button onClick={() => abort.current?.abort()} variant="secondary">
              Stop
            </Button>
          )}
          <span className="text-xs text-neutral-600">
            {running && phase
              ? `${phase} · ${Math.max(0, Math.round((now - (startedAt ?? now)) / 1000))}s`
              : status}
          </span>
        </div>
        <ErrorText>{error}</ErrorText>
        {problems.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <Badge tone="amber">Check before saving</Badge>
            <ul className="mt-1 list-disc pl-4">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Card>
  );
}
