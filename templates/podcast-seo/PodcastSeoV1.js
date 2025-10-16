import { readTemplate } from '../../utils/templateReader.js';
import { MapperUtils } from '../../utils/mapperUtils.js';
import { generateImageBuffer } from '../../utils/htmlToImageRenderer.js';
import { uploadImageBufferToSupabase, updateSupabaseColumn } from '../../utils/supabaseHelpers.js';
import { PODCAST_SEO_DIR, SOCIAL_MEDIA_PREVIEW_IMAGE_CONFIG, SUPABASE_SEO_IMAGES_BUCKET } from '../../constants.js';
import { z } from 'zod';

const PodcastSeoV1PropsSchema = z.object({
  podcastId: z.string().min(1, "Podcast ID is required"),
  podcastName: z.string().min(1, "Podcast name is required"),
  podcastImage: z.string().url("Podcast image must be a valid URL").optional(),
});

export async function PodcastSeoV1({ props, templateType }) {
  const templatePath = `${PODCAST_SEO_DIR}/PodcastSeoV1.html`;
  const fileType = 'jpg'

  try {
    const validationResult = PodcastSeoV1PropsSchema.safeParse(props || {});
    
    if (!validationResult.success) {
      console.error('Props validation failed:', validationResult.error.issues);
      return { 
        success: false, 
        error: `Props validation failed: ${validationResult.error.issues.map(e => e.message).join(', ')}` 
      };
    }

    const safeProps = validationResult.data;
    const { podcastId, ...templateProps } = safeProps;
    const fileName = `${podcastId}-${Date.now()}-v1`;

    // Read HTML template
    const html = readTemplate(templatePath);
    const { dom, document } = MapperUtils.createDOM(html);

    const dataMappings = {
      'podcastName': templateProps.podcastName,
    };

    MapperUtils.mapTextProperties(document, dataMappings);

    // Replace podcast image if provided
    if (templateProps.podcastImage) {
      MapperUtils.replaceWithImage(
        document, 
        'podcastImage', 
        templateProps.podcastImage, 
        templateProps.podcastName, 
        'podcast-image'
      );
    }

    const finalHtml = dom.serialize();

    // Step 1: Render image
    console.log('🎨 Rendering HTML to image...');

    const imageResult = await generateImageBuffer(finalHtml, SOCIAL_MEDIA_PREVIEW_IMAGE_CONFIG);

    if (!imageResult.success) {
      return { success: false, error: imageResult.error || 'Failed to render image from HTML' };
    }

    // Step 2: Upload the image
    console.log('📤 Uploading image to Supabase...');
    const uploadResult = await uploadImageBufferToSupabase({
      buffer: imageResult.buffer,
      templateType,
      fileName,
      fileType,
      bucket: SUPABASE_SEO_IMAGES_BUCKET,
    });

    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error || 'Upload failed' };
    }

    // Step 3: Update the table with the image URL
    console.log('🔄 Updating podcast table with SEO image URL...');
    const updateResult = await updateSupabaseColumn({
      tableName: 'podcasts',
      primaryKeyColumn: 'id',
      primaryKeyValue: podcastId,
      columnName: 'seo_image_url',
      columnValue: uploadResult.publicUrl
    });
    
    if (!updateResult.success) {
      console.error('❌ Failed to update podcast table:', updateResult.error);
      return { success: false, error: `Database update failed: ${updateResult.error}` };
    }
    
    console.log('✅ Successfully updated podcast table with SEO image URL');

    return uploadResult;

  } catch (error) {
    console.error('PodcastSeoV1 handler failed:', error);
    return { success: false, error: error.message };
  }
}
