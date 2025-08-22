import { readTemplate } from '../../utils/templateReader.js';
import { MapperUtils } from '../../utils/mapperUtils.js';
import { generateImageBuffer } from '../../utils/htmlToImageRenderer.js';
import { uploadImageBufferToSupabase, updateSupabaseColumn } from '../../utils/supabaseHelpers.js';
import { PODCAST_NOMINATION_SHARE_DIR, SUPABASE_SEO_IMAGES_BUCKET } from '../../constants.js';
import { z } from 'zod';

const PodcastNominationPropsSchema = z.object({
  guestName: z.string().min(1, "Guest name is required"),
  guestBio: z.string().min(1, "Guest bio is required"),
  guestImage: z.string().url("Guest image must be a valid URL"),
  podcastName: z.string().min(1, "Podcast name is required"),
  podcastFollowers: z.number().int().min(0, "Followers must be a non-negative integer"),
  podcastImage: z.string().url("Podcast image must be a valid URL"),
  voteCount: z.number().int().min(0, "Vote count must be a non-negative integer"),
  nominationId: z.uuid("Nomination ID must be a valid UUID"),
});

export async function PodcastNominationShare({ props, templateType }) {
  const templatePath = `${PODCAST_NOMINATION_SHARE_DIR}/PodcastNominationShare.html`;

  try {
    const validationResult = PodcastNominationPropsSchema.safeParse(props || {});
    
    if (!validationResult.success) {
      console.error('Props validation failed:', validationResult.error.errors);
      return { 
        success: false, 
        error: `Props validation failed: ${validationResult.error.errors.map(e => e.message).join(', ')}` 
      };
    }

    const safeProps = validationResult.data;
    const { nominationId, ...templateProps } = safeProps;
    const fileName = `podcast-nomination-${Date.now()}`;

    // Read HTML template
    const html = readTemplate(templatePath);
    const { dom, document } = MapperUtils.createDOM(html);

    const dataMappings = {
      'guestName': templateProps.guestName,
      'podcastName': templateProps.podcastName,
      'subtitle': MapperUtils.transformers.createVoteSubtitle(templateProps.voteCount),
      'guestInitials': MapperUtils.transformers.extractInitials(templateProps.guestName),
      'guestBadge': templateProps.guestName,
      'guestBio': templateProps.guestBio,
      'podcastBadge': templateProps.podcastName,
      'podcastFollowers': MapperUtils.transformers.formatFollowers(templateProps.podcastFollowers)
    };

    MapperUtils.mapTextProperties(document, dataMappings);
    MapperUtils.replaceWithImage(document, 'guestImage', templateProps.guestImage, templateProps.guestName, 'profile-image');
    MapperUtils.replaceWithImage(document, 'podcastImage', templateProps.podcastImage, templateProps.podcastName, 'podcast-image');

    const finalHtml = dom.serialize();

    // Step 1: Render image
    console.log('🎨 Rendering HTML to image...');
    const imageResult = await generateImageBuffer(finalHtml);
    if (!imageResult.success) {
      return { success: false, error: imageResult.error || 'Failed to render image from HTML' };
    }

    // Step 2: Upload the image
    console.log('📤 Uploading image to Supabase...');
    const uploadResult = await uploadImageBufferToSupabase({
      buffer: imageResult.buffer,
      templateType,
      fileName,
      bucket: SUPABASE_SEO_IMAGES_BUCKET,
      baseDir: PODCAST_NOMINATION_SHARE_DIR,
    });

    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error || 'Upload failed' };
    }

    // Step 3: Update the podcast_nomination table with the image URL
    console.log('🔄 Updating podcast_nomination table with image URL...');
    const updateResult = await updateSupabaseColumn({
      tableName: 'podcast_nomination',
      primaryKeyValue: nominationId,
      primaryKeyColumn: 'id',
      columnName: 'image_url',
      columnValue: uploadResult.publicUrl
    });
    
    if (!updateResult.success) {
      console.error('❌ Failed to update podcast_nomination table:', updateResult.error);
      return { success: false, error: `Database update failed: ${updateResult.error}` };
    }
    
    console.log('✅ Successfully updated podcast_nomination table with image URL');

    return uploadResult;

  } catch (error) {
    console.error('PodcastNominationShare handler failed:', error);
    return { success: false, error: error.message };
  }
}



