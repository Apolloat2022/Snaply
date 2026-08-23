"use client";

import { useCallback, useRef, useState } from "react";
import { LISTING_IMAGES_BUCKET, supabase } from "@/lib/supabaseClient";
import type { AnalyzeItemResponse } from "@/types/listing";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

type Status = "idle" | "dragging" | "uploading" | "analyzing" | "error";

interface ImageDropzoneProps {
  sellerRegion?: string;
  onAnalyzed: (result: AnalyzeItemResponse, imageUrl: string) => void;
}

export default function ImageDropzone({ sellerRegion, onAnalyzed }: ImageDropzoneProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      setErrorMessage(null);

      const validationError = validateFile(file);
      if (validationError) {
        setErrorMessage(validationError);
        setStatus("error");
        return;
      }

      setPreviewUrl(URL.createObjectURL(file));

      try {
        setStatus("uploading");
        const imageUrl = await uploadToSupabase(file);

        setStatus("analyzing");
        const result = await analyzeItem(imageUrl, sellerRegion);

        onAnalyzed(result, imageUrl);
        setStatus("idle");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
        setStatus("error");
      }
    },
    [onAnalyzed, sellerRegion]
  );

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setStatus("idle");
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = ""; // allow re-selecting the same file
  }

  const isBusy = status === "uploading" || status === "analyzing";

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !isBusy && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isBusy) fileInputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isBusy) setStatus("dragging");
        }}
        onDragLeave={() => setStatus((s) => (s === "dragging" ? "idle" : s))}
        onDrop={handleDrop}
        className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition
          ${status === "dragging" ? "border-neutral-900 bg-neutral-50" : "border-neutral-300"}
          ${isBusy ? "cursor-not-allowed opacity-70" : ""}`}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Selected item" className="max-h-48 rounded-lg object-contain" />
        ) : (
          <>
            <p className="font-medium text-neutral-900">Drag and drop a photo of your item</p>
            <p className="mt-1 text-sm text-neutral-500">or click to browse — JPG, PNG, WEBP, HEIC up to 10MB</p>
          </>
        )}

        {status === "uploading" && <p className="mt-3 text-sm text-neutral-600">Uploading photo…</p>}
        {status === "analyzing" && (
          <p className="mt-3 text-sm text-neutral-600">AI is identifying the item and pricing it…</p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
    </div>
  );
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Please upload a JPG, PNG, WEBP, or HEIC image.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Image must be under 10MB.";
  }
  return null;
}

async function uploadToSupabase(file: File): Promise<string> {
  const extension = file.name.split(".").pop() ?? "jpg";
  const path = `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(LISTING_IMAGES_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function analyzeItem(imageUrl: string, sellerRegion?: string): Promise<AnalyzeItemResponse> {
  const response = await fetch("/api/analyze-item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, seller_region: sellerRegion }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Item analysis failed.");
  }
  return data as AnalyzeItemResponse;
}
