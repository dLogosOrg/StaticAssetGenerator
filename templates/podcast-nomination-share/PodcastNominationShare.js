import { readTemplate } from '../../utils/templateReader.js';
import { MapperUtils } from '../../utils/mapperUtils.js';
import { generateImageBuffer } from '../../utils/htmlToImageRenderer.js';
import { uploadImageBufferToSupabase } from '../../utils/supabaseUploader.js';
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
    const fileName = `podcast-nomination-${Date.now()}`;

    // Read HTML template
    const html = readTemplate(templatePath);
    const { dom, document } = MapperUtils.createDOM(html);

    const dataMappings = {
      'guestName': safeProps.guestName,
      'podcastName': safeProps.podcastName,
      'subtitle': MapperUtils.transformers.createVoteSubtitle(safeProps.voteCount),
      'guestInitials': MapperUtils.transformers.extractInitials(safeProps.guestName),
      'guestBadge': safeProps.guestName,
      'guestBio': safeProps.guestBio,
      'podcastBadge': safeProps.podcastName,
      'podcastFollowers': MapperUtils.transformers.formatFollowers(safeProps.podcastFollowers)
    };

    MapperUtils.mapTextProperties(document, dataMappings);
    MapperUtils.replaceWithImage(document, 'guestImage', safeProps.guestImage, safeProps.guestName, 'profile-image');
    MapperUtils.replaceWithImage(document, 'podcastImage', safeProps.podcastImage, safeProps.podcastName, 'podcast-image');

    const finalHtml = dom.serialize();

    // Step 1: Render image
    console.log('🎨 Rendering HTML to image...');
    const imageResult = await generateImageBuffer(finalHtml);
    if (!imageResult.success) {
      return { success: false, error: imageResult.error || 'Failed to render image from HTML' };
    }

    // Step 2: Upload the image
    console.log('📤 Uploading image to Supabase...');
    return await uploadImageBufferToSupabase({
      buffer: imageResult.buffer,
      templateType,
      fileName,
      bucket: SUPABASE_SEO_IMAGES_BUCKET,
      baseDir: PODCAST_NOMINATION_SHARE_DIR,
    });

  } catch (error) {
    console.error('PodcastNominationShare handler failed:', error);
    return { success: false, error: error.message };
  }
}



