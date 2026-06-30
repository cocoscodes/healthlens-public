'use client';

import { useRef, useState } from 'react';
import { parseExportZip } from '@/lib/clientParse';
import type { Snapshot } from '@/lib/types';

export default function UploadZone({ onSnapshot }: { onSnapshot: (s: Snapshot, name: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handle(file: File) {
    setBusy(true);
    setError(null);
    try {
      const snap = await parseExportZip(file);
      if (!snap.rollups.length) {
        setError('No recognizable health records found in that file.');
      } else {
        onSnapshot(snap, file.name);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={dragging ? 'upload dragging' : 'upload'}
      role="group"
      aria-label="Upload your Apple Health export.zip"
      onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handle(f);
      }}
    >
      <input
        ref={inputRef}
        id="export-file"
        type="file"
        accept=".zip"
        aria-label="Choose Apple Health export.zip file"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
        }}
      />
      <p className="upload-title">Explore with your own data</p>
      <p className="upload-sub">
        Drop your Apple Health <code>export.zip</code> here, or
      </p>
      <button className="upload-btn" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? 'Parsing in your browser…' : 'Choose export.zip'}
      </button>
      <p className="upload-privacy">
        Parsed entirely in your browser. Your file never leaves your device and nothing is stored on any server.
      </p>
      {error && <p className="upload-error">{error}</p>}
    </div>
  );
}
