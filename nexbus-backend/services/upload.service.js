const crypto = require('crypto');
const { UTApi } = require('uploadthing/server');
const { AppError } = require('../utils/errors');

// 4 MB keeps the base64 request body under the 6 MB limit of Netlify functions
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

let client;
function utapi() {
  if (!process.env.UPLOADTHING_TOKEN) throw new AppError(503, 'UPLOADS_DISABLED', 'Image uploads are not configured');
  client = client || new UTApi(); // reads UPLOADTHING_TOKEN from the environment
  return client;
}

// the declared content type must match the real file signature, so other files cannot be uploaded as images
function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

// base64: raw base64 or a data: URL. Returns { url, key } of the stored file.
async function uploadImage({ base64, folder = 'images' }) {
  const data = String(base64).replace(/^data:[^,]*,/, '');
  const buf = Buffer.from(data, 'base64');
  if (!buf.length) throw new AppError(400, 'IMAGE_INVALID', 'The image is empty');
  if (buf.length > MAX_BYTES) throw new AppError(413, 'IMAGE_TOO_LARGE', 'The image is larger than 4 MB');

  const type = sniff(buf);
  if (!type) throw new AppError(400, 'IMAGE_INVALID', 'Only JPEG, PNG or WebP images are allowed');

  const name = `${folder}-${crypto.randomUUID()}.${TYPES[type]}`;
  const { data: file, error } = await utapi().uploadFiles(new File([buf], name, { type }));
  if (error || !file) {
    console.error('UploadThing upload failed:', error?.message || error);
    throw new AppError(502, 'UPLOAD_FAILED', 'The image could not be uploaded. Please try again');
  }
  return { url: file.ufsUrl || file.url, key: file.key };
}

// removing the old file must never fail the request that replaces it
async function deleteImage(key) {
  if (!key || !process.env.UPLOADTHING_TOKEN) return;
  try {
    await utapi().deleteFiles(key);
  } catch (err) {
    console.error('UploadThing delete failed:', err.message);
  }
}

module.exports = { uploadImage, deleteImage, MAX_BYTES };
