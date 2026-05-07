export type GenerationStep = 'INPUT' | 'PLANNING' | 'REVIEW' | 'GENERATING' | 'COMPLETED';

export type VisualSourceType = 'AI' | 'DOC' | 'UPLOAD';

export interface StoryboardFrame {
  id: string;
  frameNumber: number;
  script: string;
  visualPrompt: string;
  visualType?: string;
  visualSourceType: VisualSourceType;
  audioGenerated: boolean;
  visualGenerated: boolean;
  audioUrl?: string;
  visualUrl?: string;
  isGenerating: boolean;
  estimatedDuration: number;
  error?: string;
  caption?: string;
}

export interface PlanResponseItem {
  script: string;
  visualPrompt: string;
  relevantPageNumber?: number;
}

export interface FileData {
  mimeType: string;
  data: string; // Base64
}

export interface AttachedFile {
  name: string;
  mimeType: string;
  data: string; // Base64
  original: File;
}
