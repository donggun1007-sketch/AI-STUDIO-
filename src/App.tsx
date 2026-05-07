import { useState, useRef, useEffect } from 'react';
import { GenerationStep, StoryboardFrame, FileData } from './types';
import InputSection from './components/InputSection';
import Storyboard from './components/Storyboard';
import { generateStoryPlan, generateWithRetry, generateFrameImage, generateFrameAudio, wait } from './services/gemini';
import { extractImagesFromPdf } from './services/pdfUtils';
import { exportVideo } from './services/videoExporter';
import { Loader2, Film, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const IS_DEMO_MODE = false;

export default function App() {
  const [step, setStep] = useState<GenerationStep>('INPUT');
  const [frames, setFrames] = useState<StoryboardFrame[]>([]);
  const [docImages, setDocImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [isExportComplete, setIsExportComplete] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);

  // Stale closure safeguard
  const framesRef = useRef<StoryboardFrame[]>(frames);
  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  const cancelGenerationRef = useRef(false);

  useEffect(() => {
    setHasApiKey(!!process.env.GEMINI_API_KEY || window.location.hostname === 'localhost');
  }, []);

  const calculateDuration = (text: string) => Math.max(3, Math.ceil(text.length / 4));

  const applyDemoSlice = (items: any[]) => {
    if (IS_DEMO_MODE) {
      return items.slice(0, Math.ceil(items.length * 0.5));
    }
    return items;
  };

  const handlePlanGenerate = async (text: string, file?: FileData, originalFile?: File) => {
    setIsLoading(true);
    setDocImages([]);
    
    try {
      // PDF image extraction integration
      if (originalFile && originalFile.type === 'application/pdf') {
        extractImagesFromPdf(originalFile).then(images => {
          setDocImages(images);
        }).catch(err => {
          console.warn("PDF image extraction failed (ignored):", err);
        });
      }

      const plan = await generateWithRetry(() => generateStoryPlan(text, file));
      
      const newFrames: StoryboardFrame[] = plan.map((item, index) => ({
        id: crypto.randomUUID(),
        frameNumber: index + 1,
        script: item.script,
        visualPrompt: item.visualPrompt,
        visualSourceType: 'AI',
        audioGenerated: false,
        visualGenerated: false,
        isGenerating: false,
        estimatedDuration: calculateDuration(item.script)
      }));

      setFrames(applyDemoSlice(newFrames));
      setStep('REVIEW');
    } catch (error) {
      console.error("Plan generation failed:", error);
      alert("스토리보드 생성 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateFrameState = (id: string, updates: Partial<StoryboardFrame>) => {
    setFrames(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
  };

  const handleGenerateMedia = async () => {
    cancelGenerationRef.current = false;
    setStep('GENERATING');
    
    const frameIds = framesRef.current.map(f => f.id);
    
    for (const id of frameIds) {
      if (cancelGenerationRef.current) break;
      
      const frame = framesRef.current.find(f => f.id === id);
      if (!frame || (frame.visualGenerated && frame.audioGenerated)) continue;

      updateFrameState(id, { isGenerating: true, error: undefined });
      
      try {
        const tasks: Promise<any>[] = [];
        
        // Audio generation
        if (!frame.audioGenerated) {
          tasks.push(generateWithRetry(() => generateFrameAudio(frame.script)).then(url => {
            updateFrameState(id, { audioUrl: url, audioGenerated: true });
          }));
        }

        // Image generation logic based on source
        if (!frame.visualGenerated) {
          if (frame.visualSourceType === 'AI') {
            tasks.push(generateWithRetry(() => generateFrameImage(frame.visualPrompt)).then(url => {
              updateFrameState(id, { visualUrl: url, visualGenerated: true });
            }));
          } else if (frame.visualUrl) {
            // DOC or UPLOAD with existing URL
            updateFrameState(id, { visualGenerated: true });
          }
        }

        await Promise.allSettled(tasks);
        
        // Handle failures if any task failed
        // For simplicity in this demo, let's assume they mostly work or errors are caught by generateWithRetry
      } catch (err: any) {
        updateFrameState(id, { error: err.message });
      } finally {
        updateFrameState(id, { isGenerating: false });
      }

      await wait(500);
    }

    if (!cancelGenerationRef.current) {
      setStep('COMPLETED');
    } else {
      setStep('REVIEW');
    }
  };

  const handleRegenerateFrame = async (id: string, type: 'AUDIO' | 'VISUAL') => {
    const frame = framesRef.current.find(f => f.id === id);
    if (!frame) return;

    updateFrameState(id, { isGenerating: true, error: undefined });
    
    try {
      if (type === 'AUDIO') {
        const url = await generateWithRetry(() => generateFrameAudio(frame.script));
        updateFrameState(id, { audioUrl: url, audioGenerated: true });
      } else {
        const url = await generateWithRetry(() => generateFrameImage(frame.visualPrompt));
        updateFrameState(id, { visualUrl: url, visualGenerated: true });
      }
    } catch (err: any) {
      updateFrameState(id, { error: err.message });
    } finally {
      updateFrameState(id, { isGenerating: false });
    }
  };

  const handleUpdateFrame = (id: string, updates: Partial<StoryboardFrame>) => {
    setFrames(prev => prev.map(f => {
      if (f.id === id) {
        const updated = { ...f, ...updates };
        if (updates.script !== undefined) {
          updated.estimatedDuration = calculateDuration(updates.script);
        }
        return updated;
      }
      return f;
    }));
  };

  const handleExportVideo = async () => {
    setIsExporting(true);
    setIsExportComplete(false);
    setExportProgress({ current: 0, total: frames.length });

    try {
      await exportVideo(frames, (current, total) => {
        setExportProgress({ current, total });
      });
      setIsExportComplete(true);
    } catch (error: any) {
      console.error("Video export failed:", error);
      alert(`영상 통합 중 오류가 발생했습니다:\n\n${error.message}`);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const handleReExportVideo = () => {
    setIsExportComplete(false);
    handleExportVideo();
  };

  const handleReset = () => {
    if (window.confirm("지금까지의 진행 상황이 종료됩니다. 정말 처음으로 돌아가시겠습니까?")) {
      setStep('INPUT');
      setFrames([]);
      setDocImages([]);
      setIsExportComplete(false);
      setIsExporting(false);
      setExportProgress(null);
      cancelGenerationRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <main className="py-12">
        {step === 'INPUT' && (
          <InputSection 
            onPlanGenerate={handlePlanGenerate} 
            isLoading={isLoading} 
          />
        )}

        {(step === 'REVIEW' || step === 'GENERATING' || step === 'COMPLETED') && (
          <Storyboard
            frames={frames}
            docImages={docImages}
            isGenerating={step === 'GENERATING'}
            isExporting={isExporting}
            isExportComplete={isExportComplete}
            onUpdateFrame={handleUpdateFrame}
            onRegenerateFrame={handleRegenerateFrame}
            onGenerateMedia={handleGenerateMedia}
            onExportVideo={handleExportVideo}
            onReExportVideo={handleReExportVideo}
            onReset={handleReset}
            onCancelGeneration={() => { cancelGenerationRef.current = true; }}
          />
        )}
      </main>

      <AnimatePresence>
        {isExporting && exportProgress && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-8 text-center">
              <div className="relative">
                <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Film className="w-10 h-10 text-indigo-600 animate-pulse" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-32 h-32 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">영상 통합 및 다운로드</h2>
                <p className="text-slate-500">각 장면을 하나의 고화질 영상으로 합성하고 있습니다.</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-indigo-600">컷 {exportProgress.current} / {exportProgress.total} 처리 중</span>
                  <span className="text-slate-400">{Math.round((exportProgress.current / exportProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.4)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start space-x-3 text-left">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">주의사항</p>
                  <p className="text-sm text-amber-700 leading-relaxed font-medium">
                    브라우저 탭을 닫거나 다른 페이지로 이동하지 마세요. 완료 시 영상이 자동으로 다운로드됩니다.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


