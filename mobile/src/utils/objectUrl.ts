const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://readysetfly-api.onrender.com';

export const resolveObjectUrl = (value?: string | null) => {
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase();
      if (host.includes('amazonaws.com') || host.includes('s3.')) {
        return `${parsed.origin}${parsed.pathname}`;
      }
      const query = parsed.search.toLowerCase();
      if (query.includes('x-amz-') || query.includes('x-goog-') || query.includes('signature=')) {
        return `${parsed.origin}${parsed.pathname}`;
      }
      if (parsed.pathname.includes('/uploads/')) {
        const idx = parsed.pathname.indexOf('/uploads/');
        if (idx >= 0) {
          return `${API_BASE_URL}/objects/${parsed.pathname.slice(idx + 1)}`;
        }
      }
    } catch {
      return value.split('?')[0];
    }
    return value;
  }

  if (value.startsWith('/objects/')) return `${API_BASE_URL}${value}`;
  if (value.includes('/uploads/')) {
    const idx = value.indexOf('/uploads/');
    return `${API_BASE_URL}/objects/${value.slice(idx + 1)}`;
  }
  return value;
};

export const getPrimaryImageUrl = (images?: string[] | null) => {
  if (!Array.isArray(images) || images.length === 0) return null;
  return resolveObjectUrl(images[0]);
};
