import * as pdfjsLib from 'pdfjs-dist';

// Map specific operator names to their numeric IDs in PDF.js
const OPS = {
  paintImageXObject: 82, // Standard ID for paintImageXObject in many versions
  paintInlineImageXObject: 83,
};

// Set worker source
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export const extractImagesFromPdf = async (file: File): Promise<string[]> => {
  const images: string[] = [];
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const operatorList = await page.getOperatorList();
    
    for (let j = 0; j < operatorList.fnArray.length; j++) {
      const fn = operatorList.fnArray[j];
      if (fn === (pdfjsLib as any).OPS.paintImageXObject || fn === (pdfjsLib as any).OPS.paintInlineImageXObject) {
        const imgName = operatorList.argsArray[j][0];
        try {
          const img = await new Promise<any>((resolve, reject) => {
            page.objs.get(imgName, (obj: any) => {
              if (obj) resolve(obj);
              else reject('Image object not found');
            });
          });

          const { width, height, data, bitmap } = img;

          // Filter small icons
          if (width < 50 || height < 50) continue;

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          // Handle white background for JPEG output (blocks black transparency)
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, width, height);

          if (bitmap) {
            // ImageBitmap source
            ctx.drawImage(bitmap, 0, 0);
          } else if (data) {
            // Raw pixel data
            const imageData = ctx.createImageData(width, height);
            
            // PDF.js uses different formats depending on the source
            // Some are Gray, some RGB, some RGBA
            const len = data.length;
            const pixels = imageData.data;
            
            if (len === width * height * 4) {
              // RGBA - Alpha blending with white
              for (let d = 0; d < len; d += 4) {
                const alpha = data[d + 3] / 255;
                pixels[d] = data[d] * alpha + 255 * (1 - alpha);
                pixels[d+1] = data[d+1] * alpha + 255 * (1 - alpha);
                pixels[d+2] = data[d+2] * alpha + 255 * (1 - alpha);
                pixels[d+3] = 255;
              }
            } else if (len === width * height * 3) {
              // RGB
              for (let d = 0, s = 0; d < len; d += 3, s += 4) {
                pixels[s] = data[d];
                pixels[s+1] = data[d+1];
                pixels[s+2] = data[d+2];
                pixels[s+3] = 255;
              }
            } else if (len === width * height) {
              // Grayscale
              for (let d = 0, s = 0; d < len; d++, s += 4) {
                pixels[s] = data[d];
                pixels[s+1] = data[d];
                pixels[s+2] = data[d];
                pixels[s+3] = 255;
              }
            }
            ctx.putImageData(imageData, 0, 0);
          }

          images.push(canvas.toDataURL('image/jpeg', 0.8));
        } catch (e) {
          console.warn("Error extracting image object:", e);
        }
      }
    }
    await page.cleanup();
  }
  
  return images;
};
