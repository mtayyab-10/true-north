"use client";
import { useRef, useState } from "react";

interface Props {
  onImageSelect: (base64: string, mime: string, preview: string) => void;
  preview: string | null;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_MB = 19;

export default function Uploader({ onImageSelect, preview }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const process = (file: File) => {
    setErr(null);
    if (!ACCEPTED.includes(file.type)) {
      setErr("Please upload a JPEG, PNG, WebP or GIF image.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setErr(`Image must be under ${MAX_MB} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      onImageSelect(base64, file.type, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) process(file);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) process(file);
  };

  return (
    <div>
      <div
        className={`upload-zone ${dragOver ? "drag-over" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        id="upload-zone"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        aria-label="Upload document image"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Document preview" className="upload-zone__preview" />
        ) : (
          <>
            <div className="upload-zone__icon">📷</div>
            <div className="upload-zone__text">
              Drop your bill, invoice or ledger photo here
            </div>
            <div className="upload-zone__hint">
              JPEG · PNG · WebP · up to 19 MB · English or Urdu labels supported
            </div>
          </>
        )}
      </div>
      {err && <div className="alert alert--error" style={{ marginTop: "8px" }}><span>⚠</span><span>{err}</span></div>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        style={{ display: "none" }}
        onChange={onChange}
        id="file-input"
      />
    </div>
  );
}
