export const decode = (base64: string): Uint8Array => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> => {
  // Gemini TTS returns 16-bit PCM (Int16) at 24kHz
  const numSamples = data.length / 2;
  const audioBuffer = ctx.createBuffer(numChannels, numSamples, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let i = 0; i < numSamples; i++) {
    const s = view.getInt16(i * 2, true); // Little endian
    channelData[i] = s / 32768.0;
  }
  
  return audioBuffer;
};

export const normalizeAudioBuffer = (
  buffer: AudioBuffer,
  targetPeak: number = 0.95
): AudioBuffer => {
  const channelData = buffer.getChannelData(0);
  let maxPeak = 0;
  for (let i = 0; i < channelData.length; i++) {
    const abs = Math.abs(channelData[i]);
    if (abs > maxPeak) maxPeak = abs;
  }

  if (maxPeak < 0.0001) return buffer;

  const gain = targetPeak / maxPeak;
  for (let i = 0; i < channelData.length; i++) {
    channelData[i] = Math.max(-1, Math.min(1, channelData[i] * gain));
  }
  
  return buffer;
};

export const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const samples = buffer.getChannelData(0);
  const len = samples.length;
  const bufferWav = new ArrayBuffer(44 + len * 2);
  const view = new DataView(bufferWav);
  
  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + len * 2, true);
  writeString(view, 8, 'WAVE');
  
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, bitDepth, true);
  
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, len * 2, true);
  
  // Write PCM samples
  const offset = 44;
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  return new Blob([bufferWav], { type: 'audio/wav' });
};

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
