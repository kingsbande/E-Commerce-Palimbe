import { supabase } from "./client";

export type PhotoItem = {
  key: string;
  uri: string;
  base64?: string;
  existingUrl?: string;
};

const BUCKET = "product-images";

async function uploadImage(base64: string, userId: string): Promise<string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  if (bytes.length < 1000) {
    throw new Error("A photo looks empty. Please remove it and add it again.");
  }

  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes.buffer as ArrayBuffer, { contentType: "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function saveImages(photos: PhotoItem[], userId: string): Promise<string[]> {
  const uploaded = await Promise.all(
    photos.map(async (photo) => {
      if (photo.existingUrl) return photo.existingUrl;
      if (photo.base64) return uploadImage(photo.base64, userId);
      return null;
    })
  );
  return uploaded.filter((url): url is string => url !== null);
}

function storagePathFromUrl(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

export async function removeImages(urls: string[]): Promise<void> {
  const paths = urls.map(storagePathFromUrl).filter((path): path is string => !!path);
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(BUCKET).remove(paths);
  } catch {
    // ignore
  }
}
