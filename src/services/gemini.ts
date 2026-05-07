import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { MODEL_PLANNING, MODEL_IMAGE, MODEL_TTS, SYSTEM_INSTRUCTION_PLANNER } from "../constants";
import { FileData, PlanResponseItem } from "../types";
import { decode, decodeAudioData, normalizeAudioBuffer, audioBufferToWav } from "./audioUtils";

let aiInstance: GoogleGenAI | null = null;
let sharedAudioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContext({ sampleRate: 24000 });
  }
  return sharedAudioContext;
};

export const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || "";
    
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is missing. AI features will not work.");
  }
  
  if (!aiInstance || (aiInstance as any).apiKey !== apiKey) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export const generateStoryPlan = async (
  documentText: string,
  file?: FileData
): Promise<PlanResponseItem[]> => {
  const ai = getClient();
  
  const parts: any[] = [{ text: `문서 내용:\n${documentText}` }];
  if (file) {
    parts.push({
      inlineData: {
        mimeType: file.mimeType,
        data: file.data,
      },
    });
  }

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: MODEL_PLANNING,
    contents: { parts },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_PLANNER,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            script: { type: Type.STRING },
            visualPrompt: { type: Type.STRING },
          },
          required: ["script", "visualPrompt"],
        },
      },
    }
  });

  const text = response.text || "[]";
  return JSON.parse(text);
};

export const generateFrameImage = async (prompt: string): Promise<string> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL_IMAGE,
    contents: { 
      parts: [
        { text: `장면 설명: ${prompt}. 고화질 발전소 작업 현장 스타일로 그려줘.` }
      ] 
    }
  } as any);

  const parts = response.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData);
  
  if (imagePart) {
    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
  }
  
  throw new Error("이미지 생성 결과가 없습니다.");
};

export const generateFrameAudio = async (text: string): Promise<string> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL_TTS,
    contents: {
      parts: [{ text }]
    },
    config: {
      // @ts-ignore
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
      responseModalities: ["audio"]
    }
  } as any);

  const parts = response.candidates?.[0]?.content?.parts || [];
  const audioPart = parts.find((p: any) => p.inlineData);

  if (audioPart) {
    const rawData = decode(audioPart.inlineData.data);
    const ctx = getAudioContext();
    let audioBuffer = await decodeAudioData(rawData, ctx);
    audioBuffer = normalizeAudioBuffer(audioBuffer);
    const wavBlob = audioBufferToWav(audioBuffer);
    return URL.createObjectURL(wavBlob);
  }

  throw new Error("오디오 생성 결과가 없습니다.");
};

export const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const generateWithRetry = async <T>(
  fn: (onStatusUpdate?: (msg: string) => void) => Promise<T>,
  onStatusUpdate?: (msg: string) => void
): Promise<T> => {
  let attempt = 0;
  while (true) {
    try {
      return await fn(onStatusUpdate);
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const isQuotaError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED");
      
      if (isQuotaError) {
        attempt++;
        let delay = 30000; // Default 30s
        
        // Try to parse 'retry in Ns'
        const match = errorMsg.match(/retry in (\d+)s/);
        if (match) {
          delay = parseInt(match[1]) * 1000 + 1000;
        } else {
          delay = Math.max(5000, delay);
        }
        
        onStatusUpdate?.(`API 할당량 초과. ${Math.round(delay/1000)}초 후 재시도합니다... (시도 ${attempt})`);
        await wait(delay);
        continue;
      }
      
      throw error;
    }
  }
};
