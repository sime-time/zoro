import type { ExtractedMedia, MediaAttachment } from "./types";

function inferMimeTypeFromUrl(url: string): string | null {
  const pathname = new URL(url).pathname.toLowerCase();

  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".gif")) return "image/gif";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".heic")) return "image/heic";
  if (pathname.endsWith(".heif")) return "image/heif";
  if (pathname.endsWith(".bmp")) return "image/bmp";
  if (pathname.endsWith(".tiff")) return "image/tiff";
  if (pathname.endsWith(".avif")) return "image/avif";

  if (pathname.endsWith(".m4a")) return "audio/mp4";
  if (pathname.endsWith(".mp3")) return "audio/mpeg";
  if (pathname.endsWith(".wav")) return "audio/wav";
  if (pathname.endsWith(".aac")) return "audio/aac";
  if (pathname.endsWith(".ogg")) return "audio/ogg";
  if (pathname.endsWith(".caf")) return "audio/x-caf";
  if (pathname.endsWith(".amr")) return "audio/amr";

  return null;
}

function getMimeType(attachment: MediaAttachment): string | null {
  return attachment.media_type || inferMimeTypeFromUrl(attachment.url);
}

export function extractImageAttachments(
  attachments: MediaAttachment[],
): ExtractedMedia[] {
  const extracted = attachments.flatMap((attachment) => {
    const mimeType = getMimeType(attachment);

    if (!mimeType?.startsWith("image/")) {
      return [];
    }

    return [{ url: attachment.url, mimeType }];
  });

  return extracted;
}

export function extractAudioAttachments(
  attachments: MediaAttachment[],
): ExtractedMedia[] {
  const extracted = attachments.flatMap((attachment) => {
    const mimeType = getMimeType(attachment);

    if (!mimeType?.startsWith("audio/")) {
      return [];
    }

    return [{ url: attachment.url, mimeType }];
  });

  return extracted;
}
