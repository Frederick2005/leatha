import { supabase } from "@/integrations/supabase/client";

const BUCKET = "lesson-attachments";
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload an avatar image and return the resulting public URL.
 * Uses the `lesson-attachments` public bucket under the `avatars/{uid}/…` prefix
 * so we don't need a dedicated public bucket.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("File must be an image");
  if (file.size > MAX_BYTES) throw new Error("Image must be smaller than 5MB");

  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const path = `avatars/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
