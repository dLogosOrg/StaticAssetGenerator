import fs from 'fs';
import puppeteer from 'puppeteer';
import { POSSIBLE_PUPPETEER_EXECUTABLE_PATHS, PUPPETEER_ARGS } from '../constants.js';

function pathExists(p) {
  try { return Boolean(p) && fs.existsSync(p); } catch { return false; }
}

function resolveExecutablePath() {  
  // 1) Explicit override via env
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (pathExists(envPath)) {
    console.log(`Using Chrome executable from env: ${envPath}`);
    return envPath;
  }

  // 2) Puppeteer's suggestion, but only if it exists on disk
  try {
    const suggested = puppeteer.executablePath();
    if (pathExists(suggested)) {
      return suggested;
    } else if (suggested) {
      console.warn(`Puppeteer suggested executable does not exist: ${suggested}`);
    }
  } catch (error) {
    console.warn('Could not resolve Puppeteer suggested executable path:', error.message);
  }

  // 3) Search known locations (works in both dev and prod)
  for (const chromePath of POSSIBLE_PUPPETEER_EXECUTABLE_PATHS) {
    if (pathExists(chromePath)) {
      console.log(`Found Chrome at: ${chromePath}`);
      return chromePath;
    }
  }

  // 4) As a last resort, return undefined and let Puppeteer try default
  return undefined;
}

async function waitForFonts(page, timeoutMs = 10000) { // 10s timeout
  console.log('🖼️ Waiting for fonts to load...');
  await page.evaluate(async (ms) => {
    // timeout if the document promise does not resolve
    const withTimeout = (promise, ms) => new Promise(resolve => {
      let settled = false;
      const t = setTimeout(() => { if (!settled) resolve(); }, ms);
      promise.then(() => { if (!settled) { settled = true; clearTimeout(t); resolve(); } })
             .catch(() => { if (!settled) { settled = true; clearTimeout(t); resolve(); } });
    });

    try {
      if (document.fonts && document.fonts.ready) {
        await withTimeout(document.fonts.ready, ms);
      }
    } catch (error) {
      console.warn('⚠️ Fonts failed to load:', error.message);
    }
  }, timeoutMs);
}

async function waitForImages(page, timeoutMs = 10000) { // 10s timeout
  console.log('🖼️ Waiting for images to load/decode...');
  await page.evaluate(async (ms) => {
    // timeout if the document promise does not resolve
    const withTimeout = (promise, ms) => new Promise(resolve => {
      let settled = false;
      const t = setTimeout(() => { if (!settled) resolve(); }, ms);
      promise.then(() => { if (!settled) { settled = true; clearTimeout(t); resolve(); } })
             .catch(() => { if (!settled) { settled = true; clearTimeout(t); resolve(); } });
    });

    const images = Array.from(document.images || []);
    const waitForImage = async (img) => {
      if (!(img.complete && img.naturalWidth > 0)) {
        await new Promise(resolve => {
          const done = () => { img.removeEventListener('load', done); img.removeEventListener('error', done); resolve(); };
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        });
      }
      if (img.decode) {
        try { 
          await img.decode(); 
        } catch (error) {
          console.warn('⚠️ Image failed to decode:', img.src || 'unknown image', error.message);
        }
      }
    };

    await withTimeout(Promise.all(images.map(waitForImage)), ms);
  }, timeoutMs);
}

export async function generateImageBuffer(htmlContent, options = {}) {
  let browser;

  try {
    console.log("🎨 Starting image rendering from HTML...");

    const executablePath = resolveExecutablePath();
    console.log(`Using Chrome executable: ${executablePath ?? 'default'}`);

    // Launch Puppeteer and render HTML
    browser = await puppeteer.launch({
      args: PUPPETEER_ARGS,
      headless: true,
      executablePath: executablePath,
      ignoreDefaultArgs: ['--disable-extensions']
    });

    const page = await browser.newPage();

    // Inject base URL into HTML so relative paths resolve correctly
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const htmlWithBase = htmlContent.replace(
      '<head>',
      `<head><base href="${baseUrl}">`
    );
    
    await page.setContent(htmlWithBase, { waitUntil: "networkidle2" });
    console.log("✅ HTML rendered in Puppeteer with base URL:", baseUrl);

    // Ensure fonts and images are fully loaded and decoded
    await waitForFonts(page);
    await waitForImages(page);

    // Optionally set a fixed viewport to control screenshot dimensions
    const { type, viewportWidth, viewportHeight, deviceScaleFactor, quality } = options || {};
    let useFixedViewport = false;
    if (Number.isInteger(viewportWidth) && Number.isInteger(viewportHeight) && viewportWidth > 0 && viewportHeight > 0) {
      await page.setViewport({
        width: viewportWidth,
        height: viewportHeight,
        deviceScaleFactor: Number.isFinite(deviceScaleFactor) && deviceScaleFactor > 0 ? deviceScaleFactor : 1
      });
      useFixedViewport = true;
      console.log(`🖼️ Using fixed viewport: ${viewportWidth}x${viewportHeight} @${useFixedViewport ? (deviceScaleFactor || 1) : 1}x`);
    }
    

    // Determine output type and quality
    const requestedType = typeof type === 'string' ? type.toLowerCase() : undefined;
    const hasQuality = Number.isInteger(quality) && quality >= 0 && quality <= 100;
    const effectiveType = requestedType
      ? requestedType
      : (hasQuality ? 'jpeg' : 'png');

    const screenshotOptions = {
      type: effectiveType,
      // If a fixed viewport is provided, capture only the viewport area; otherwise capture the full page
      fullPage: !useFixedViewport
    };

    // Only include quality when supported and valid (jpeg/ webp only)
    if ((effectiveType === 'jpeg' || effectiveType === 'webp') && hasQuality) {
      screenshotOptions.quality = quality;
    }

    console.log('📸 Taking screenshot...');
    const buffer = await page.screenshot(screenshotOptions);

    if (browser) await browser.close();
    console.log('✅ Screenshot captured');

    return { success: true, buffer };

  } catch (err) {
    console.error('❌ Image generation failed:', err);
    try { if (browser) await browser.close(); } catch {}
    return { success: false, error: err.message };
  }
}
