import { readTemplate } from '../../utils/templateReader.js';
import { MapperUtils } from '../../utils/mapperUtils.js';
import { generateImageBuffer } from '../../utils/htmlToImageRenderer.js';
import { uploadImageBufferToSupabase, updateSupabaseColumn } from '../../utils/supabaseHelpers.js';
import { SOCIAL_MEDIA_PREVIEW_IMAGE_CONFIG, SPEAKER_SEO_DIR, SUPABASE_SEO_IMAGES_BUCKET } from '../../constants.js';
import { z } from 'zod';

const SpeakerSeoV1PropsSchema = z.object({
  speakerId: z.string().min(1, "Speaker ID is required"),
  speakerName: z.string().min(1, "Speaker name is required"),
  speakerImage: z.string().url("Speaker image must be a valid URL").or(z.literal("")).optional(),
  sourceTable: z.enum(["profiles", "reserved_profiles"], {
    errorMap: () => ({ message: "Table name must be either 'profiles' or 'reserved_profiles'" }),
  }),
});

export async function SpeakerSeoV1({ props, templateType }) {
  const templatePath = `${SPEAKER_SEO_DIR}/SpeakerSeoV1.html`;
  const fileType = 'jpg'

  try {
    const validationResult = SpeakerSeoV1PropsSchema.safeParse(props || {});
    
    if (!validationResult.success) {
      console.error('Props validation failed:', validationResult.error.issues);
      return { 
        success: false, 
        error: `Props validation failed: ${validationResult.error.issues.map(e => e.message).join(', ')}` 
      };
    }

    const safeProps = validationResult.data;
    const { speakerId, sourceTable, ...templateProps } = safeProps;
    const fileName = `${speakerId}-${Date.now()}-v1`;

    // Read HTML template
    const html = readTemplate(templatePath);
    const { dom, document } = MapperUtils.createDOM(html);

    const dataMappings = {
      'speakerName': templateProps.speakerName,
      'speakerInitials': MapperUtils.transformers.extractInitials(templateProps.speakerName),
    };

    MapperUtils.mapTextProperties(document, dataMappings);

    // Replace speaker image if provided and not empty
    if (templateProps.speakerImage && templateProps.speakerImage.trim() !== '') {
      MapperUtils.replaceWithImage(
        document, 
        'speakerImage', 
        templateProps.speakerImage, 
        templateProps.speakerName, 
        'speaker-image'
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
    console.log('🔄 Updating speaker table with SEO image URL...');
    const updateResult = await updateSupabaseColumn({
      tableName: sourceTable,
      primaryKeyColumn: 'id',
      primaryKeyValue: speakerId,
      columnName: 'seo_image_url',
      columnValue: uploadResult.publicUrl
    });
    
    if (!updateResult.success) {
      console.error('❌ Failed to update speaker table:', updateResult.error);
      return { success: false, error: `Database update failed: ${updateResult.error}` };
    }
    
    console.log('✅ Successfully updated speaker table with SEO image URL');

    return uploadResult;

  } catch (error) {
    console.error('SpeakerSeoV1 handler failed:', error);
    return { success: false, error: error.message };
  }
}