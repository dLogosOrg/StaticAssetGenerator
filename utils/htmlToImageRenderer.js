import fs from 'fs';
import puppeteer from 'puppeteer';
import { POSSIBLE_PUPPETEER_EXECUTABLE_PATHS, PUPPETEER_ARGS } from '../constants.js';

function resolveExecutablePath() {  
  // For production environments, try to find Chrome in common locations
  if (process.env.NODE_ENV === 'production') {
    for (const chromePath of POSSIBLE_PUPPETEER_EXECUTABLE_PATHS) {
      try {
        if (fs.existsSync(chromePath)) {
          console.log(`Found Chrome at: ${chromePath}`);
          return chromePath;
        }
      } catch (e) {
        // Continue to next path
      }
    }
  }
  
  // Else, fallback to Puppeteer's bundled Chrome
  try {
    return puppeteer.executablePath();
  } catch (error) {
    console.warn('Could not resolve Puppeteer executable path:', error.message);
    return undefined;
  }
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

export async function generateImageBuffer(htmlContent) {
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

    await page.setContent(htmlContent, { waitUntil: "networkidle2" });
    console.log("✅ HTML rendered in Puppeteer");

    // Ensure fonts and images are fully loaded and decoded
    await waitForFonts(page);
    await waitForImages(page);

    console.log('📸 Taking screenshot...');
    const buffer = await page.screenshot({
      type: "png",
      fullPage: true
    });

    if (browser) await browser.close();
    console.log('✅ Screenshot captured');

    return { success: true, buffer };

  } catch (err) {
    console.error('❌ Image generation failed:', err);
    try { if (browser) await browser.close(); } catch {}
    return { success: false, error: err.message };
  }
}
