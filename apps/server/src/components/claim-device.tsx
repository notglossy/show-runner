"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/client/api";
import { Button, ErrorText, inputBase } from "./ui";

/** Claim by pairing code. Pass `pairingCode` to pre-fill (unclaimed device card) or omit for manual entry. */
export function ClaimDevice({ pairingCode, defaultName }: { pairingCode?: string; defaultName?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(pairingCode ?? "");
  const [name, setName] = useState(defaultName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("/api/devices/claim", { method: "POST", body: { pairingCode: code, name } });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {!pairingCode && (
          <input
            className={`${inputBase} w-28 font-mono uppercase`}
            placeholder="Code"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        )}
        <input className={`${inputBase} min-w-40 flex-1`} placeholder="Name, e.g. Kitchen" value={name} onChange={(e) => setName(e.target.value)} required />
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Claiming…" : "Claim"}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
