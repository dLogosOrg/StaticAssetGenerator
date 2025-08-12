import { PodcastNominationShare } from './templates/podcast-nomination-share/PodcastNominationShare.js';
import { PODCAST_NOMINATION_SHARE_DIR } from './constants.js';

// Maps template types to their processing functions
export const templateRegistry = {
  'podcast-nomination': {
    handler: PodcastNominationShare,
    directory: PODCAST_NOMINATION_SHARE_DIR
  }
};

export async function handleTemplateRequest(templateType, props = {}) {
  const template = templateRegistry[templateType] || null;
  if (!template) {
    return { success: false, error: `Template type '${templateType}' not found` };
  }

  // Await the async handler
  return await template.handler({ props, templateType });
}

export function getAvailableTemplateTypes() {
  return Object.keys(templateRegistry);
}

export function getTemplateInfo(templateType) {
  const template = templateRegistry[templateType];
  if (!template) {
    return null;
  }
  
  return {
    type: templateType,
    directory: template.directory,
    hasHandler: !!template.handler
  };
}

export function getTemplateDirectory(templateType) {
  const template = templateRegistry[templateType];
  return template?.directory || null;
}
