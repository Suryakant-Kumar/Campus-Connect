import { put } from '@vercel/blob';

export interface UploadResult {
  url: string;
  provider: 'vercel_blob' | 'supabase' | 'direct';
}

/**
 * Uploads a photo buffer or base64 data to online cloud storage (Vercel Blob / Supabase),
 * completely stateless with ZERO local disk writes.
 */
export async function uploadPhotoOnline(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<UploadResult> {
  // 1. Check for Vercel Blob Token
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await put(`campus-issues/${Date.now()}-${fileName}`, fileBuffer, {
        access: 'public',
        contentType,
      });
      return {
        url: blob.url,
        provider: 'vercel_blob',
      };
    } catch (err) {
      console.error('Vercel Blob upload failed:', err);
    }
  }

  // 2. Check for Supabase Storage if configured
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabaseUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
      const bucketName = process.env.SUPABASE_BUCKET || 'campus-photos';
      const cleanFileName = `issues/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucketName}/${cleanFileName}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: new Uint8Array(fileBuffer) as any,
      });

      if (res.ok) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${cleanFileName}`;
        return {
          url: publicUrl,
          provider: 'supabase',
        };
      }
    } catch (err) {
      console.error('Supabase storage upload failed:', err);
    }
  }

  // 3. Fallback: Data URL stored in database directly (stateless, zero filesystem writes)
  const base64 = fileBuffer.toString('base64');
  return {
    url: `data:${contentType};base64,${base64}`,
    provider: 'direct',
  };
}
