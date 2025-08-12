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

export async function generateImageBuffer(htmlContent) {
  try {
    console.log("🎨 Starting image rendering from HTML...");

    const executablePath = resolveExecutablePath();
    console.log(`Using Chrome executable: ${executablePath ?? 'default'}`);

    // Launch Puppeteer and render HTML
    const browser = await puppeteer.launch({
      args: PUPPETEER_ARGS,
      headless: true,
      executablePath: executablePath,
      ignoreDefaultArgs: ['--disable-extensions']
    });

    const page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: "networkidle2" });
    console.log("✅ HTML rendered in Puppeteer");

    // Take screenshot with full page height
    const buffer = await page.screenshot({
      type: "png",
      fullPage: true
    });

    await browser.close();
    console.log("✅ Screenshot captured");

    return { success: true, buffer };

  } catch (err) {
    console.error("❌ Image generation failed:", err);
    return { success: false, error: err.message };
  }
}
