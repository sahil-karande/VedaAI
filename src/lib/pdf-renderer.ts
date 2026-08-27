import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker source
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

/**
 * Renders all pages of a PDF file into an array of base64 PNG image data URLs.
 * @param file The PDF file object
 * @param maxDimension Maximum width/height for rendered page images (default 1600px for sharp OCR)
 */
export async function renderPdfToPageImages(
  file: File,
  maxDimension = 1200
): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const pageImages: string[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const initialViewport = page.getViewport({ scale: 1.0 });

    // Calculate scale factor to reach desired max dimension for optimal OCR speed & quality
    const maxSide = Math.max(initialViewport.width, initialViewport.height);
    const scale = maxSide > 0 ? maxDimension / maxSide : 1.2;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // Fill white background for clear contrast
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport: viewport,
    }).promise;

    // Output JPEG for ~10x smaller size and 10x faster network payload transfer
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    pageImages.push(dataUrl);
  }

  return pageImages;
}

/**
 * Rotates an image base64 Data URL by a specific angle (90, 180, 270 degrees clockwise)
 * and returns the rotated image Data URL.
 */
export async function rotateImageDataUrl(
  dataUrl: string,
  degrees: number
): Promise<string> {
  const normalizedDegrees = ((degrees % 360) + 360) % 360;
  if (normalizedDegrees === 0) return dataUrl;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      if (normalizedDegrees === 90 || normalizedDegrees === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      ctx.save();
      if (normalizedDegrees === 90) {
        ctx.translate(canvas.width, 0);
        ctx.rotate((90 * Math.PI) / 180);
      } else if (normalizedDegrees === 180) {
        ctx.translate(canvas.width, canvas.height);
        ctx.rotate((180 * Math.PI) / 180);
      } else if (normalizedDegrees === 270) {
        ctx.translate(0, canvas.height);
        ctx.rotate((270 * Math.PI) / 180);
      }

      ctx.drawImage(img, 0, 0);
      ctx.restore();

      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };

    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}
