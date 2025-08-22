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

// ============================================================================
// STORAGE UTILITIES
// ============================================================================

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

    const supabase = getSupabaseClient();
    const { error: uploadError } = await supabase
      .storage
      .from(bucket)
      .upload(objectPath, buffer, { contentType: 'image/png', upsert: false });

    if (uploadError) {
      throw uploadError;
    }

    const publicUrl = `${supabase.supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;

    return { success: true, path: objectPath, publicUrl };
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

    return {
      success: true,
      publicUrl: uploadResult.publicUrl,
      bucket: target.bucket,
      path: uploadResult.path
    };

  } catch (error) {
    console.error('Image buffer upload to Supabase failed:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// DATABASE UTILITIES
// ============================================================================

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




