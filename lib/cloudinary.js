/**
 * Uploads a file to Cloudinary using unsigned upload preset
 * @param {File} file - The file object to upload
 * @returns {Promise<string>} The uploaded image secure URL
 */
export async function uploadToCloudinary(file) {
  if (!file) throw new Error("No file provided");

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "weh6ewqn";
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "ml_default";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData?.error?.message || "Failed to upload image to Cloudinary");
  }

  const data = await response.json();
  return data.secure_url;
}
