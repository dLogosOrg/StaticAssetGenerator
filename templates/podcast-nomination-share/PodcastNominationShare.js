import { readTemplate } from '../../utils/templateReader.js';
import { MapperUtils } from '../../utils/mapperUtils.js';
import { generateImageBuffer } from '../../utils/htmlToImageRenderer.js';
import { uploadImageBufferToSupabase, updateSupabaseColumn } from '../../utils/supabaseHelpers.js';
import { PODCAST_NOMINATION_SHARE_DIR, SUPABASE_SEO_IMAGES_BUCKET } from '../../constants.js';
import { z } from 'zod';

function createVoteSubtitle(voteCount) {
  if (typeof voteCount !== 'number' || voteCount <= 0) {
    return 'Be the first to vote to see this conversation happen';
  }
  if (voteCount === 1) {
    return 'Join 1 person who wants to see this conversation happen';
  }
  return `Join ${voteCount.toLocaleString()} people who want to see this conversation happen`;
}

const PodcastNominationPropsSchema = z.object({
  guestName: z.string().min(1, "Guest name is required"),
  guestBio: z.string().optional(),
  guestImage: z.string().url("Guest image must be a valid URL"),
  podcastName: z.string().min(1, "Podcast name is required"),
  podcastFollowers: z.number().int().min(0, "Followers must be a non-negative integer").optional(),
  podcastImage: z.string().url("Podcast image must be a valid URL"),
  voteCount: z.number().int().min(0, "Vote count must be a non-negative integer").optional(),
  nominationId: z.uuid("Nomination ID must be a valid UUID"),
});

export async function PodcastNominationShare({ props, templateType }) {
  const templatePath = `${PODCAST_NOMINATION_SHARE_DIR}/PodcastNominationShare.html`;

  try {
    const validationResult = PodcastNominationPropsSchema.safeParse(props || {});
    
    if (!validationResult.success) {
      console.error('Props validation failed:', validationResult.error.issues);
      return { 
        success: false, 
        error: `Props validation failed: ${validationResult.error.issues.map(e => e.message).join(', ')}` 
      };
    }

    const safeProps = validationResult.data;
    const { nominationId, ...templateProps } = safeProps;
    const fileName = `${Date.now()}`;

    // Read HTML template
    const html = readTemplate(templatePath);
    const { dom, document } = MapperUtils.createDOM(html);

    const dataMappings = {
      'guestName': templateProps.guestName,
      'podcastName': templateProps.podcastName,
      'guestInitials': MapperUtils.transformers.extractInitials(templateProps.guestName),
      'guestBadge': templateProps.guestName,
      'podcastBadge': templateProps.podcastName,
    };

    MapperUtils.mapTextProperties(document, dataMappings);
    // Remove optional elements if not provided
    if (!templateProps.guestBio) {
      const bioEl = document.querySelector('[data-dynamic="guestBio"]');
      if (bioEl && bioEl.parentNode) {
        bioEl.parentNode.removeChild(bioEl);
      }
    }
    if (templateProps.podcastFollowers === undefined || templateProps.podcastFollowers === null) {
      const followersEl = document.querySelector('[data-dynamic="podcastFollowers"]');
      if (followersEl && followersEl.parentNode) {
        followersEl.parentNode.removeChild(followersEl);
      }
    }
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



