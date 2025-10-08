// buckets
export const SUPABASE_MARKETING_ASSETS_BUCKET = 'marketing-assets';
export const SUPABASE_SEO_IMAGES_BUCKET = 'seo-images';
export const FALLBACK_BUCKET = 'generated-images';

// directories
export const PODCAST_NOMINATION_SHARE_DIR = 'podcast-nomination-share';
export const SPEAKER_SEO_DIR = 'speaker-seo';

// puppeteer configs
export const POSSIBLE_PUPPETEER_EXECUTABLE_PATHS = [
  './chrome/chrome/linux-139.0.7258.66/chrome-linux64/chrome',
  './chrome/chrome-linux64/chrome',
  './.cache/puppeteer/chrome/linux-139.0.7258.66/chrome-linux64/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium'
];

export const PUPPETEER_ARGS = [
  '--no-sandbox', // handle chrome launch issues with docker
  '--disable-setuid-sandbox', // handles sandbox related issues
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--hide-scrollbars',
  '--disable-web-security',
  '--disable-features=VizDisplayCompositor'
];

export const SOCIAL_MEDIA_PREVIEW_IMAGE_CONFIG = {
  viewportWidth: 1200,
  viewportHeight: 630,
  quality: 70,
}

export const TEMPLATE_DIRECTORIES = {
  'podcast-nomination': PODCAST_NOMINATION_SHARE_DIR,
  'speaker-seo': SPEAKER_SEO_DIR
};