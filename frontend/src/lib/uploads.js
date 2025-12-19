export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB (must match Flask MAX_UPLOAD_BYTES)
export const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];

export function validateImageFile(file) {
  if (!file) return null;
  if (!ALLOWED_IMAGE_MIMES.includes(file.type)) return "Թույլատրվում է միայն JPG/PNG/WEBP";
  if (file.size > MAX_IMAGE_SIZE_BYTES) return "Ֆայլը շատ մեծ է (մաքս․ 8 ՄԲ)";
  return null;
}
