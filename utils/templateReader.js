import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function readTemplate(templateName) {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', ...templateName.split('/'));
    const htmlContent = fs.readFileSync(templatePath, 'utf8');
    return htmlContent;
  } catch (error) {
    console.error(`Error reading template ${templateName}:`, error);
    throw new Error(`Failed to read template: ${templateName}`);
  }
}

export function getAvailableTemplates() {
  try {
    const templatesDir = path.join(__dirname, '..', 'templates');
    const files = fs.readdirSync(templatesDir);
    return files.filter(file => file.endsWith('.html'));
  } catch (error) {
    console.error('Error reading templates directory:', error);
    return [];
  }
}
