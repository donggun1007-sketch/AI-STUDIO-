import { StoryboardFrame } from "./types";
import { normalizeAudioBuffer } from "./audioUtils";

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm"
];

const WIDTH = 1920;
const HEIGHT = 1080;

export async function exportVideo(
  frames: StoryboardFrame[],
  onProgress: (current: number, total: number) => void
): Promise<void> {
  const total = frames.length;
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("Could not get 2D context");

  const stream = canvas.captureStream(30);
  const videoTrack = stream.getVideoTracks()[0];
  const audioTrack = dest.stream.getAudioTracks()[0];
  
  const combinedStream = new MediaStream([videoTrack, audioTrack]);

  const supportedMime = MIME_CANDIDATES.find(m => MediaRecorder.isTypeSupported(m)) || "video/webm";
  const recorder = new MediaRecorder(combinedStream, { mimeType: supportedMime });
  
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  
  const blobUrlsToRevoke: string[] = [];

  const loadAudio = async (url: string) => {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    return normalizeAudioBuffer(audioBuffer);
  };

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      img.onload = () => resolve(img);
      img.onerror = reject;
    });
  };

  const wrapText = (text: string, maxWidth: number) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx2d.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
  };

  const renderFrame = (visual: HTMLImageElement | null, caption: string) => {
    ctx2d.fillStyle = "black";
    ctx2d.fillRect(0, 0, WIDTH, HEIGHT);

    if (visual) {
      // Aspect fill logic
      const scale = Math.max(WIDTH / visual.width, HEIGHT / visual.height);
      const x = (WIDTH / 2) - (visual.width / 2) * scale;
      const y = (HEIGHT / 2) - (visual.height / 2) * scale;
      ctx2d.drawImage(visual, x, y, visual.width * scale, visual.height * scale);
    }

    // Subtitles
    ctx2d.font = 'bold 48px "Noto Sans KR", sans-serif';
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'bottom';
    
    const maxWidth = WIDTH * 0.8;
    const lines = wrapText(caption, maxWidth).reverse();
    
    lines.forEach((line, i) => {
      const py = HEIGHT - 80 - (i * 60);
      ctx2d.strokeStyle = "black";
      ctx2d.lineWidth = 6;
      ctx2d.strokeText(line, WIDTH / 2, py);
      ctx2d.fillStyle = "white";
      ctx2d.fillText(line, WIDTH / 2, py);
    });
  };

  recorder.start();
  // Brief pause to avoid empty start
  recorder.pause();

  try {
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      onProgress(i + 1, total);

      // Prefetch current assets
      const [audioBuffer, visualImg] = await Promise.all([
        loadAudio(frame.audioUrl!),
        frame.visualUrl ? loadImage(frame.visualUrl) : Promise.resolve(null)
      ]);

      const durationMs = audioBuffer.duration * 1000;
      const silenceSec = i > 0 ? 0.4 : 0;
      const startTime = audioCtx.currentTime + silenceSec;

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(dest);
      source.start(startTime);

      recorder.resume();

      const startPerf = performance.now();
      const totalFrameDuration = (silenceSec * 1000) + durationMs;

      await new Promise<void>((resolve) => {
        const tick = (now: number) => {
          const elapsed = now - startPerf;
          renderFrame(visualImg, frame.script);
          
          if (elapsed < totalFrameDuration) {
            requestAnimationFrame(tick);
          } else {
            recorder.pause();
            resolve();
          }
        };
        requestAnimationFrame(tick);
      });
    }

    recorder.resume();
    recorder.stop();

    await new Promise<void>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: supportedMime });
        const ext = supportedMime.includes("video/mp4") ? "mp4" : "webm";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `KHNP_Safety_Report_${new Date().getTime()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve();
      };
    });

  } finally {
    audioCtx.close();
  }
}
