import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { FALLBACK_BUCKET } from '../constants.js';

let cachedSupabaseClient = null;

function getSupabaseClient() {
  if (cachedSupabaseClient) return cachedSupabaseClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  cachedSupabaseClient = createClient(supabaseUrl, supabaseKey, {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false
  });

  return cachedSupabaseClient;
}

// STORAGE UTILITIES

async function ensureBucketExists(bucket) {
  try {
    const supabase = getSupabaseClient();
    
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }
    
    const bucketExists = buckets.some(b => b.name === bucket);
    
    if (!bucketExists) {
      // Create bucket if it doesn't exist
      const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: true,
        allowedMimeTypes: ['image/*'],
        fileSizeLimit: '5MB'
      });
      
      if (createError) {
        throw new Error(`Failed to create bucket: ${createError.message}`);
      }
      
      console.log(`Created bucket: ${bucket}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to ensure bucket exists:', error);
    return { success: false, error: error.message };
  }
}

async function ensureBucketExistsWithFallback(bucket) {
  try {
    // First try with the requested bucket
    const result = await ensureBucketExists(bucket);
    if (result.success) {
      return { success: true, bucket };
    }
    
    // If bucket creation failed, try with fallback bucket
    console.warn(`Failed to create bucket '${bucket}', falling back to default bucket '${FALLBACK_BUCKET}'`);
    
    const fallbackResult = await ensureBucketExists(FALLBACK_BUCKET);
    if (fallbackResult.success) {
      return { success: true, bucket: FALLBACK_BUCKET, fallback: true };
    }
    
    // If even fallback fails, return the error
    return { success: false, error: `Failed to create both requested bucket '${bucket}' and fallback bucket '${FALLBACK_BUCKET}'` };
    
  } catch (error) {
    console.error('Failed to ensure bucket exists with fallback:', error);
    return { success: false, error: error.message };
  }
}

function sanitizeFileName(fileName, defaultExt = 'png') {
  const base = fileName && String(fileName).trim().length > 0
    ? String(fileName).trim()
    : `image-${Date.now()}`;
  const hasExt = base.toLowerCase().endsWith(`.${defaultExt.toLowerCase()}`);
  const withExt = hasExt ? base : `${base}.${defaultExt}`;
  return withExt.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function buildObjectPath(baseDir, fileName) {
  const joined = path.posix.join(baseDir || '', fileName || 'image.png');
  return joined.replace(/^\/+/, '');
}

function prepareUploadTarget({ templateType, fileName, bucket, baseDir, date } = {}) {
  const targetBucket = bucket ?? FALLBACK_BUCKET;
  const targetBaseDir = baseDir ?? ""; // fallback to the root directory
  const safeFileName = sanitizeFileName(fileName ?? `${templateType}-${Date.now()}`, 'png');
  const objectPath = buildObjectPath(targetBaseDir, safeFileName);
  return { bucket: targetBucket, objectPath, fileName: safeFileName };
}

async function uploadImageBufferToBucket({ bucket, objectPath, buffer }) {
  try {
    if (!bucket) throw new Error('bucket is required');
    if (!objectPath) throw new Error('objectPath is required');
    if (!buffer) throw new Error('buffer is required');

    // Ensure bucket exists before uploading
    const ensureResult = await ensureBucketExistsWithFallback(bucket);
    if (!ensureResult.success) {
      throw new Error(`Failed to ensure bucket exists: ${ensureResult.error}`);
    }

    const actualBucket = ensureResult.bucket;

    const supabase = getSupabaseClient();
    const { error: uploadError } = await supabase
      .storage
      .from(actualBucket)
      .upload(objectPath, buffer, { contentType: 'image/png', upsert: false });

    if (uploadError) {
      throw uploadError;
    }

    return { 
      success: true, 
      path: objectPath, 
      bucket: actualBucket,
      fallback: ensureResult.fallback || false
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function uploadImageBufferToSupabase({
  buffer,
  templateType,
  fileName,
  bucket,
  baseDir = "",
}) {
  try {
    if (!buffer) {
      return { success: false, error: 'Image buffer is required' };
    }

    const selectedBucket = bucket ?? FALLBACK_BUCKET;
    const target = prepareUploadTarget({ templateType, fileName, bucket: selectedBucket, baseDir });

    // Upload the buffer
    const uploadResult = await uploadImageBufferToBucket({
      bucket: target.bucket,
      objectPath: target.objectPath,
      buffer,
    });

    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error || 'Upload failed' };
    }

    // Generate the public URL for the uploaded image
    const supabase = getSupabaseClient();
    const { data: publicUrlData } = supabase.storage
      .from(uploadResult.bucket)
      .getPublicUrl(uploadResult.path);
    
    // Log if fallback was used
    if (uploadResult.fallback) {
      console.log(`⚠️  Upload completed using fallback bucket '${uploadResult.bucket}' and root directory`);
    }

    console.log('Public url', publicUrlData.publicUrl);
    
    return {
      success: true,
      bucket: uploadResult.bucket,
      path: uploadResult.path,
      publicUrl: publicUrlData.publicUrl,
      fallback: uploadResult.fallback || false // Include fallback information
    };

  } catch (error) {
    console.error('Image buffer upload to Supabase failed:', error);
    return { success: false, error: error.message };
  }
}

// DATABASE UTILITIES

export async function updateSupabaseColumn({
  tableName,
  primaryKeyValue,
  primaryKeyColumn = 'id',
  columnName,
  columnValue
}) {
  try {
    if (!tableName) throw new Error('tableName is required');
    if (primaryKeyValue === undefined || primaryKeyValue === null) throw new Error('primaryKeyValue is required');
    if (!columnName) throw new Error('columnName is required');

    const supabase = getSupabaseClient();
    
    const updateData = {
      [columnName]: columnValue
    };

    const { data, error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq(primaryKeyColumn, primaryKeyValue)
      .select();

    if (error) {
      console.error(`Failed to update ${tableName}.${columnName}:`, error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      data: data?.[0] || null,
      message: `Successfully updated ${columnName} in ${tableName}`
    };

  } catch (error) {
    console.error('Supabase column update failed:', error);
    return { success: false, error: error.message };
  }
}




