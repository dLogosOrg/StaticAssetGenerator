import { JSDOM } from 'jsdom';

/**
 * Simple utility for mapping props to HTML templates
 */
export class MapperUtils {
  static mapTextProperties(document, mappings) {
    Object.entries(mappings).forEach(([dataAttr, value]) => {
      if (value !== undefined && value !== null) {
        const elements = document.querySelectorAll(`[data-dynamic="${dataAttr}"]`);
        elements.forEach(element => {
          element.textContent = value;
        });
      }
    });
  }

  static replaceWithImage(document, dataAttr, imageSrc, altText, className = '') {
    if (!imageSrc) return;

    const placeholder = document.querySelector(`[data-dynamic="${dataAttr}"]`);
    if (placeholder) {
      const img = document.createElement('img');
      img.src = imageSrc;
      img.alt = altText;
      if (className) img.className = className;
      placeholder.parentNode.replaceChild(img, placeholder);
    }
  }

  static createDOM(htmlContent) {
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;
    return { dom, document };
  }

  // Common data transformations
  static transformers = {
    formatNumber: (num) => num.toLocaleString(),
    extractInitials: (name) => name.split(' ').map(n => n[0]).join('').toUpperCase(),
    formatFollowers: (followers) => `${followers.toLocaleString()} followers`
  };
}
