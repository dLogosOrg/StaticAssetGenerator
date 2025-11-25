export function cleanXHandle(handle) {
  if (typeof handle !== 'string') {
    return '';
  }

  const trimmed = handle.trim();
  if (!trimmed) {
    return '';
  }

  // Remove any leading @ characters and lowercase the remaining handle
  return trimmed.replace(/^@+/, '').toLowerCase();
}


