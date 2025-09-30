export function injectStaticImageSrc(document, selector, path) {
  if (!document || !selector || !path) return;

  const element = document.querySelector(selector);
  if (!element) return;

  const baseUrl = process.env.BASE_URL;

  element.setAttribute('src', `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`);
}


