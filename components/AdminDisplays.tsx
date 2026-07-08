'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { AdminOperator } from '@/components/AdminOperators';

export interface AdminDisplay {
  id: string;
  code: string;
  name: string;
  org_name: string;
  status: string;
  item_count: number;
  created_at: string;
}

interface DraftItem {
  media_url: string;
  media_type: 'image' | 'video';
}

const inputCls =
  'rounded-md border border-border-soft bg-card px-3 py-2 text-sm text-ink outline-none focus:border-rust';

// Custom displays from the admin panel: upload creative(s), get a Kovio
// /display/<code> link — point any robot or screen at it and it loops
// full-screen. Same engine the OEM display builder used.
export default function AdminDisplays({
  displays,
  operators,
}: {
  displays: AdminDisplay[];
  operators: AdminOperator[];
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [orgId, setOrgId] = useState(operators[0]?.org_id ?? '');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [createdLink, setCreatedLink] = useState('');
  const [copied, setCopied] = useState('');

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(''), 2000);
    } catch {}
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    setUploading(true);
    try {
      const supabase = createClient();
      for (const file of Array.from(files)) {
        const isVid = file.type.startsWith('video');
        const isImg = file.type.startsWith('image');
        if (!isVid && !isImg) {
          setError(`${file.name}: only images and video are supported.`);
          continue;
        }
        if (file.size > 100 * 1024 * 1024) {
          setError(`${file.name}: over the 100 MB limit.`);
          continue;
        }
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `displays/admin/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from('creatives').upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) {
          setError(upErr.message || 'Upload failed.');
          continue;
        }
        const { data } = supabase.storage.from('creatives').getPublicUrl(path);
        setItems((prev) => [...prev, { media_url: data.publicUrl, media_type: isVid ? 'video' : 'image' }]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function create() {
    if (!name.trim()) return setError('Name the display.');
    if (!orgId) return setError('Pick which operator it belongs to.');
    if (items.length === 0) return setError('Upload at least one creative.');
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { data, error } = await supabase.rpc('kovio_admin_create_display', {
      p_org_id: orgId,
      p_name: name.trim(),
      p_items: items,
      p_default_seconds: 8,
    });
    setBusy(false);
    if (error) {
      setError('Could not create the display.');
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const link = `${window.location.origin}/display/${row?.code}`;
    setCreatedLink(link);
    void copy(link);
    setName('');
    setItems([]);
    router.refresh();
  }

  async function toggle(d: AdminDisplay) {
    const supabase = createClient();
    await supabase.rpc('kovio_admin_set_display_status', {
      p_id: d.id,
      p_status: d.status === 'active' ? 'paused' : 'active',
    });
    router.refresh();
  }

  async function remove(d: AdminDisplay) {
    if (!confirm(`Delete “${d.name}”? Its /display/${d.code} link stops working immediately.`)) return;
    const supabase = createClient();
    await supabase.rpc('kovio_admin_delete_display', { p_id: d.id });
    router.refresh();
  }

  return (
    <div>
      {/* create */}
      <div className="rounded-lg border border-border-soft bg-card p-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1.4fr_1fr_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name — e.g. Robot.com storefront loop" className={inputCls} />
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={inputCls}>
            {operators.map((o) => (
              <option key={o.org_id} value={o.org_id}>{o.name}</option>
            ))}
          </select>
          <label className={`cursor-pointer rounded-md border border-border-soft px-4 py-2 text-center text-sm text-ink hover:bg-page ${uploading ? 'opacity-60' : ''}`}>
            {uploading ? 'Uploading…' : '+ Add creative(s)'}
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                void handleUpload(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        {items.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {items.map((it, i) => (
              <span key={i} className="inline-flex items-center gap-2 rounded-md border border-border-soft bg-page px-2 py-1.5">
                <span className="h-9 w-14 overflow-hidden rounded bg-black">
                  {it.media_type === 'video' ? (
                    <video src={it.media_url} muted className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.media_url} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <button onClick={() => setItems((p) => p.filter((_, j) => j !== i))} className="text-xs text-danger">✕</button>
              </span>
            ))}
          </div>
        )}

        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        {createdLink && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-good">
            Display live at <code className="break-all rounded border border-border-soft bg-page px-2 py-1 text-ink-2">{createdLink}</code>
            <button onClick={() => copy(createdLink)} className="rounded-md border border-border-soft px-2 py-1 text-ink hover:bg-page">
              {copied === createdLink ? 'Copied ✓' : 'Copy'}
            </button>
          </p>
        )}
        <button
          onClick={create}
          disabled={busy || uploading || !name.trim() || items.length === 0}
          className="mt-3 rounded-md bg-rust px-4 py-2 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-40"
        >
          {busy ? 'Creating…' : 'Create display & copy link'}
        </button>
      </div>

      {/* list */}
      {displays.length > 0 && (
        <div className="mt-4 grid gap-2">
          {displays.map((d) => {
            const link = `/display/${d.code}`;
            return (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-soft bg-card px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{d.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${d.status === 'active' ? 'bg-good/10 text-good' : 'border border-border-soft text-ink-2'}`}>
                      {d.status}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-2">
                    {d.org_name} · {d.item_count} item{d.item_count === 1 ? '' : 's'} ·{' '}
                    <code className="text-ink-2">{link}</code>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => copy(`${window.location.origin}${link}`)} className="rounded-md border border-border-soft px-2.5 py-1.5 text-xs text-ink hover:bg-page">
                    {copied === `${window.location.origin}${link}` ? 'Copied ✓' : 'Copy link'}
                  </button>
                  <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-md border border-border-soft px-2.5 py-1.5 text-xs text-ink hover:bg-page">
                    Open
                  </a>
                  <button onClick={() => toggle(d)} className="rounded-md border border-border-soft px-2.5 py-1.5 text-xs text-ink hover:bg-page">
                    {d.status === 'active' ? 'Pause' : 'Activate'}
                  </button>
                  <button onClick={() => remove(d)} className="text-xs text-danger hover:opacity-80">
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
