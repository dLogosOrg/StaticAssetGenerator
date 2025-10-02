export function injectStaticImageSrc(document, selector, path) {
  if (!document || !selector || !path) return;

  const element = document.querySelector(selector);
  if (!element) return;

  const baseUrl = process.env.BASE_URL;

  const source = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`

  console.log('Injecting static image src:', source);

  element.setAttribute('src', source);
}


