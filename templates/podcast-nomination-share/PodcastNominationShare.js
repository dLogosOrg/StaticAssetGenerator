import { readTemplate } from '../../utils/templateReader.js';
import { MapperUtils } from '../../utils/mapperUtils.js';
import { generateImageBuffer } from '../../utils/htmlToImageRenderer.js';
import { uploadImageBufferToSupabase } from '../../utils/supabaseHelpers.js';
import { PODCAST_NOMINATION_SHARE_DIR, SOCIAL_MEDIA_PREVIEW_IMAGE_CONFIG, SUPABASE_SEO_IMAGES_BUCKET } from '../../constants.js';
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
  guestName: z.string().min(1),
  guestBio: z.string().optional().default(""),
  guestImage: z.string().optional().default(""),
  podcastName: z.string().min(1),
  podcastSlug: z.string().min(1),
  podcastFollowers: z.number().int().nonnegative().optional(),
  podcastImage: z.string().optional().default(""),
  voteCount: z.number().int().positive().optional(),
  xHandle: z.string().min(1)
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
    const { podcastSlug, xHandle, ...templateProps } = safeProps;

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
    
    // Replace guest image if provided and not empty
    if (templateProps.guestImage && templateProps.guestImage.trim() !== '') {
      MapperUtils.replaceWithImage(document, 'guestImage', templateProps.guestImage, templateProps.guestName, 'profile-image');
    }
    
    // Replace podcast image if provided and not empty
    if (templateProps.podcastImage && templateProps.podcastImage.trim() !== '') {
      MapperUtils.replaceWithImage(document, 'podcastImage', templateProps.podcastImage, templateProps.podcastName, 'podcast-image');
    }

    const finalHtml = dom.serialize();

    // Step 1: Render image
    console.log('🎨 Rendering HTML to image...');
    const imageResult = await generateImageBuffer(finalHtml, SOCIAL_MEDIA_PREVIEW_IMAGE_CONFIG);

    if (!imageResult.success) {
      return { success: false, error: imageResult.error || 'Failed to render image from HTML' };
    }

    // Step 2: Upload the image to Supabase storage in nominations directory
    console.log('📤 Uploading image to Supabase storage (nominations directory)...');
    
    // Create filename: xhandle_podcastSlug.jpg
    const fileName = `${xHandle}_${podcastSlug}.jpg`;
    
    const uploadResult = await uploadImageBufferToSupabase({
      buffer: imageResult.buffer,
      templateType,
      fileName,
      fileType: "jpg",
      bucket: SUPABASE_SEO_IMAGES_BUCKET,
      baseDir: "nominations",
    });

    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error || 'Upload failed' };
    }

    console.log(`✅ Image saved to Supabase storage: ${uploadResult.path}`);
    
    return uploadResult;

  } catch (error) {
    console.error('PodcastNominationShare handler failed:', error);
    return { success: false, error: error.message };
  }
}



