'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { formatRelative } from '@/lib/format';
import type { ApiKeyMeta, MintedApiKey } from '@/lib/types';

export default function FleetApiKeys({
  fleetId,
  initialKeys,
}: {
  fleetId: string;
  initialKeys: ApiKeyMeta[];
}) {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKeyMeta[]>(initialKeys);
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [name, setName] = useState('');
  const [minted, setMinted] = useState<MintedApiKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { data, error } = await apiClient.oemMintApiKey(fleetId, { name });
    setLoading(false);
    if (error || !data) {
      setError(error?.detail ?? 'Could not mint key.');
      return;
    }
    setMinted(data);
    setMode('list');
    setName('');
  }

  function dismissMinted() {
    if (minted) {
      const { secret: _secret, ...meta } = minted;
      setKeys((k) => [meta, ...k]);
      setMinted(null);
    }
    router.refresh();
  }

  async function revoke(id: string) {
    setLoading(true);
    await apiClient.oemRevokeApiKey(fleetId, id);
    setKeys((k) => k.filter((x) => x.id !== id));
    setConfirmId(null);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border-soft bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base text-ink">API keys</h3>
        {mode === 'list' && !minted && (
          <button
            onClick={() => setMode('form')}
            className="rounded-md border border-border-soft px-3 py-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
          >
            Generate new key
          </button>
        )}
      </div>

      {mode === 'form' && (
        <form onSubmit={generate} className="mt-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm text-ink-2">Key name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tank prod"
              className="w-full rounded-md border border-border-mid bg-card px-4 py-2.5 text-sm text-ink focus:border-rust focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !name}
            className="rounded-md bg-rust px-4 py-2.5 text-sm text-page hover:bg-rust-dark disabled:opacity-50"
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
          <button
            type="button"
            onClick={() => setMode('list')}
            className="px-2 py-2.5 text-sm text-ink-2 hover:text-ink"
          >
            Cancel
          </button>
        </form>
      )}

      {minted && (
        <div className="mt-4 rounded-lg border border-rust-soft bg-rust-soft/40 p-4">
          <div className="font-mono text-label uppercase text-rust-dark">New API key · save this now</div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-card px-3 py-2 font-mono text-sm text-ink">
              {minted.secret}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(minted.secret);
                setCopied(true);
              }}
              className="shrink-0 rounded-md border border-border-mid px-3 py-2 text-sm text-ink-2 hover:text-ink"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-xs text-rust-dark">
            This is the only time you’ll see this key. After you close this panel, only the prefix
            is visible.
          </p>
          <button
            onClick={dismissMinted}
            className="mt-3 rounded-md bg-rust px-4 py-2 text-sm text-page hover:bg-rust-dark"
          >
            I’ve saved it
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-4">
        {keys.length === 0 ? (
          <p className="text-sm text-ink-3">No API keys yet. Generate one to connect a robot.</p>
        ) : (
          <ul>
            {keys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between border-b border-dashed border-border-soft py-3 last:border-0 text-sm"
              >
                <div className="flex-1">
                  <span className="text-ink">{k.name}</span>
                  <span className="ml-3 font-mono text-xs text-ink-3">{k.key_prefix}•••</span>
                </div>
                <span className="w-32 text-xs text-ink-3">
                  {k.last_used_at ? `used ${formatRelative(k.last_used_at)}` : 'never used'}
                </span>
                <span className="w-28 text-xs text-ink-3">{formatRelative(k.created_at)}</span>
                {confirmId === k.id ? (
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-ink-3">Revoke? Robots using it stop working.</span>
                    <button onClick={() => revoke(k.id)} disabled={loading} className="text-xs text-danger">
                      Confirm
                    </button>
                    <button onClick={() => setConfirmId(null)} className="text-xs text-ink-3">
                      No
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmId(k.id)}
                    className="text-xs text-ink-3 transition-colors hover:text-danger"
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
