// AVIF where the browser shows it (about 40% smaller than WebP for the intro's pictures), WebP everywhere else.
// The check decodes a 1x1 AVIF, which takes a millisecond; every intro picture waits on it.
const AVIF_1PX = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';
export const imgExt = typeof Image === 'undefined' ? Promise.resolve('webp') : new Promise(resolve => {
  const img = new Image();
  img.onload = () => resolve(img.width > 0 ? 'avif' : 'webp');
  img.onerror = () => resolve('webp');
  img.src = AVIF_1PX;
});
