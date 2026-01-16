/**
 * Utility functions for cleaning and processing image URLs
 */

/**
 * Removes query parameters and common size suffixes from image URLs
 * 
 * Examples:
 * - https://example.com/image_normal.jpg -> https://example.com/image.jpg
 * - https://example.com/image_small.jpg?size=200 -> https://example.com/image.jpg
 * - https://example.com/image.jpg?v=1&size=200 -> https://example.com/image.jpg
 * 
 * @param {string} url - The image URL to clean
 * @returns {string} - The cleaned image URL
 */
export function cleanImageUrl(url) {
  if (typeof url !== 'string' || !url.trim()) {
    return url;
  }

  try {
    // Parse the URL
    const urlObj = new URL(url);
    
    // Remove query parameters
    urlObj.search = '';
    
    // Get the pathname and process the filename
    const pathname = urlObj.pathname;
    const pathParts = pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    
    // Common image size suffixes to remove (before file extension)
    const sizeSuffixes = [
      '_normal', '_small', '_large', '_medium', '_thumb', '_thumbnail',
      '_mini', '_big', '_original', '_square', '_circle', '_round'
    ];
    
    // Extract file extension
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) {
      // No extension found, return URL without query params
      return urlObj.toString();
    }
    
    const nameWithoutExt = filename.substring(0, lastDotIndex);
    const extension = filename.substring(lastDotIndex);
    
    // Remove size suffixes from filename
    let cleanedName = nameWithoutExt;
    for (const suffix of sizeSuffixes) {
      if (cleanedName.endsWith(suffix)) {
        cleanedName = cleanedName.slice(0, -suffix.length);
        break; // Only remove one suffix (the last matching one)
      }
    }
    
    // Reconstruct the path
    pathParts[pathParts.length - 1] = cleanedName + extension;
    urlObj.pathname = pathParts.join('/');
    
    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, try a simple regex approach
    console.warn('Failed to parse URL, using regex fallback:', error.message);
    
    // Remove query parameters
    let cleaned = url.split('?')[0];
    
    // Remove common size suffixes before file extension
    const sizeSuffixes = [
      '_normal', '_small', '_large', '_medium', '_thumb', '_thumbnail',
      '_mini', '_big', '_original', '_square', '_circle', '_round'
    ];
    
    for (const suffix of sizeSuffixes) {
      // Match suffix before file extension (e.g., .jpg, .png, .jpeg)
      const regex = new RegExp(`(${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(\\.(jpg|jpeg|png|gif|webp|svg))$`, 'i');
      cleaned = cleaned.replace(regex, '$2');
    }
    
    return cleaned;
  }
}

