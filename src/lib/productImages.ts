import { supabase } from "./supabase";

// One photo in the product form. Existing photos have existingUrl set.
// Newly added photos have base64 set.
export type PhotoItem = {
  key: string;
  uri: string;
  base64?: string;
  existingUrl?: string;
};

const BUCKET = "product-images";

// Uploads a photo given as base64 text and returns its public URL.
export async function uploadImage(base64: string, userId: string): Promise<string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  if (bytes.length < 1000) {
    throw new Error("A photo looks empty. Please remove it and add it again.");
  }

  // The folder must be the user's id (storage security rule)
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes.buffer as ArrayBuffer, { contentType: "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Keeps existing photos as they are, uploads new ones, and keeps the order.
export async function saveImages(photos: PhotoItem[], userId: string): Promise<string[]> {
  const urls: string[] = [];
  for (const p of photos) {
    if (p.existingUrl) urls.push(p.existingUrl);
    else if (p.base64) urls.push(await uploadImage(p.base64, userId));
  }
  return urls;
}

export function storagePathFromUrl(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

// Best effort: a failure to delete a file never blocks the user.
export async function removeImages(urls: string[]): Promise<void> {
  const paths = urls.map(storagePathFromUrl).filter((p): p is string => !!p);
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(BUCKET).remove(paths);
  } catch {
    // ignore
  }
}
