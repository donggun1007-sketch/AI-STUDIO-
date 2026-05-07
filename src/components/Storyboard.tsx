import { useState } from 'react';
import { StoryboardFrame } from '../types';
import { Clock, Play, RotateCcw, XCircle, Wand2, AlertTriangle, Image as ImageIcon, Volume2, Upload, FileImageIcon, CheckCircle2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StoryboardProps {
  frames: StoryboardFrame[];
  docImages: string[];
  onGenerateMedia: () => void;
  isGenerating: boolean;
  isExporting: boolean;
  isExportComplete: boolean;
  onUpdateFrame: (id: string, updates: Partial<StoryboardFrame>) => void;
  onRegenerateFrame: (id: string, type: 'AUDIO' | 'VISUAL') => void;
  onExportVideo: () => void;
  onReExportVideo: () => void;
  onReset: () => void;
  onCancelGeneration: () => void;
}

export default function Storyboard({
  frames,
  docImages,
  onGenerateMedia,
  isGenerating,
  isExporting,
  isExportComplete,
  onUpdateFrame,
  onRegenerateFrame,
  onExportVideo,
  onReExportVideo,
  onReset,
  onCancelGeneration
}: StoryboardProps) {
  const totalDuration = frames.reduce((acc, f) => acc + (f.estimatedDuration || 0), 0);
  const isOverTime = totalDuration > 180;
  const isAllComplete = frames.length > 0 && frames.every(f => f.visualGenerated && f.audioGenerated);

  const [activeImageSelector, setActiveImageSelector] = useState<string | null>(null);
  const [dragOverFrameId, setDragOverFrameId] = useState<string | null>(null);

  const handleSelectDocImage = (frameId: string, imageUrl: string) => {
    onUpdateFrame(frameId, {
      visualSourceType: 'DOC',
      visualUrl: imageUrl,
      visualGenerated: true
    });
    setActiveImageSelector(null);
  };

  const processFile = (file: File, frameId: string) => {
    if (!file.type.startsWith('image/')) {
      alert("이미지 파일만 업로드 가능합니다.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      onUpdateFrame(frameId, {
        visualSourceType: 'UPLOAD',
        visualUrl: e.target?.result as string,
        visualGenerated: true
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 pb-32">
      {/* Control Bar */}
      <div className="sticky top-4 z-10 flex items-center justify-between p-4 bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl shadow-lg">
        <div className="flex items-center space-x-4">
          <button
            onClick={onReset}
            disabled={isGenerating}
            className="flex items-center space-x-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="font-medium">처음으로</span>
          </button>

          <div className="h-6 w-[1px] bg-slate-200" />

          <div className="flex items-center space-x-2">
            <Clock className={`w-4 h-4 ${isOverTime ? 'text-red-500' : 'text-slate-400'}`} />
            <span className={`font-mono text-sm font-bold ${isOverTime ? 'text-red-600' : 'text-slate-700'}`}>
              총 예상 시간: {Math.floor(totalDuration / 60)}:{String(totalDuration % 60).padStart(2, '0')}
            </span>
            {isOverTime && (
              <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded uppercase tracking-wider">
                3분 초과
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {isGenerating && (
            <button
              onClick={onCancelGeneration}
              className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
            >
              <XCircle className="w-4 h-4" />
              <span className="font-medium">생성 취소</span>
            </button>
          )}

          {isExportComplete && (
            <button
              onClick={onReExportVideo}
              disabled={isExporting}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="font-medium">영상 다시 만들기</span>
            </button>
          )}

          <button
            onClick={isAllComplete && !isExportComplete ? onExportVideo : onGenerateMedia}
            disabled={isGenerating || isExporting || frames.length === 0}
            className={`flex items-center space-x-2 px-6 py-2 rounded-lg transition-all shadow-md disabled:opacity-50 ${
              isExportComplete 
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-100' 
                : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-100'
            }`}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="font-bold">영상 통합 중...</span>
              </>
            ) : isExportComplete ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-bold">다운로드 완료</span>
              </>
            ) : isAllComplete ? (
              <>
                <Download className="w-4 h-4" />
                <span className="font-bold">최종 영상 다운로드</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span className="font-bold">미디어 생성 시작</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isGenerating && (
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <motion.div
            className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
            initial={{ width: 0 }}
            animate={{ width: `${(frames.filter(f => !f.isGenerating && f.visualGenerated && f.audioGenerated).length / frames.length) * 100}%` }}
          />
        </div>
      )}

      {/* Grid of Frames */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {frames.map((frame, index) => (
          <motion.div
            key={frame.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`group relative bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col ${
              dragOverFrameId === frame.id ? 'border-amber-500 ring-2 ring-amber-200' : 'border-slate-200'
            }`}
          >
            {/* Visual Header */}
            <div 
              className="aspect-video bg-slate-900 relative overflow-hidden flex items-center justify-center cursor-pointer group/header"
              tabIndex={0}
              onDragOver={(e) => { e.preventDefault(); setDragOverFrameId(frame.id); }}
              onDragLeave={() => setDragOverFrameId(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverFrameId(null);
                if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0], frame.id);
              }}
              onPaste={(e) => {
                const item = e.clipboardData.items[0];
                if (item?.type.startsWith('image/')) {
                  const file = item.getAsFile();
                  if (file) processFile(file, frame.id);
                }
              }}
              onClick={() => {
                if (frame.visualSourceType === 'UPLOAD') document.getElementById(`file-${frame.id}`)?.click();
                else if (frame.visualSourceType === 'DOC') setActiveImageSelector(frame.id);
              }}
            >
              {frame.visualUrl ? (
                <img src={frame.visualUrl} className="w-full h-full object-cover" alt={`Frame ${frame.frameNumber}`} />
              ) : (
                <div className="flex flex-col items-center space-y-2 opacity-50">
                  {frame.visualSourceType === 'AI' && <ImageIcon className="w-8 h-8 text-white" />}
                  {frame.visualSourceType === 'DOC' && <FileImageIcon className="w-8 h-8 text-white" />}
                  {frame.visualSourceType === 'UPLOAD' && <Upload className="w-8 h-8 text-white" />}
                  <span className="text-[10px] text-white font-bold uppercase tracking-widest">
                    {frame.visualSourceType} MODE
                  </span>
                </div>
              )}

              {/* Status Labels */}
              <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-sm rounded text-[10px] font-bold text-white uppercase tracking-widest">
                SCENE {frame.frameNumber}
              </div>
              
              {/* Regeneration Overlay for AI Mode */}
              {frame.visualSourceType === 'AI' && (
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/header:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRegenerateFrame(frame.id, 'VISUAL'); }}
                    className="p-3 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-md transition-all transform hover:scale-110"
                  >
                    <RotateCcw className="w-6 h-6 text-white" />
                  </button>
                </div>
              )}

              {/* Change Overlay for DOC/UPLOAD */}
              {(frame.visualSourceType === 'DOC' || frame.visualSourceType === 'UPLOAD') && frame.visualUrl && (
                <div className="absolute top-3 right-3 opacity-0 group-hover/header:opacity-100 transition-opacity">
                  <div className="px-3 py-1 bg-black/50 backdrop-blur-sm rounded text-[10px] font-bold text-white uppercase">
                    변경하기
                  </div>
                </div>
              )}

              {/* Loader */}
              {frame.isGenerating && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                  <div className="flex flex-col items-center space-y-3">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                    <span className="text-[10px] font-bold text-white animate-pulse uppercase tracking-tighter">Processing...</span>
                  </div>
                </div>
              )}

              <input
                id={`file-${frame.id}`}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], frame.id)}
              />
            </div>

            <div className="p-5 space-y-4 flex-1 flex flex-col">
              {/* Media Controls */}
              <div className="flex items-center justify-between">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  {(['AI', 'DOC', 'UPLOAD'] as const).map((type) => {
                    if (type === 'DOC' && docImages.length === 0) return null;
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          const isSwitchingToAI = type === 'AI' && frame.visualSourceType !== 'AI';
                          onUpdateFrame(frame.id, { 
                            visualSourceType: type,
                            ...(isSwitchingToAI ? { visualUrl: undefined, visualGenerated: false } : {})
                          });
                        }}
                        className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all ${
                          frame.visualSourceType === type 
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
                
                <div className="flex items-center space-x-2">
                  {frame.audioUrl && (
                    <button 
                      onClick={() => {
                        const audio = new Audio(frame.audioUrl);
                        audio.play();
                      }}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => onRegenerateFrame(frame.id, 'AUDIO')}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <textarea
                  className="w-full text-sm text-slate-700 bg-transparent border-none focus:ring-0 p-0 resize-none font-medium leading-relaxed"
                  value={frame.script}
                  rows={2}
                  onChange={(e) => onUpdateFrame(frame.id, { script: e.target.value })}
                />
              </div>

              <div className="h-[1px] bg-slate-100" />

              <div className="space-y-1">
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed italic">
                  {frame.visualPrompt}
                </p>
              </div>

              {frame.error && (
                <div className="mt-auto pt-2">
                  <div className="flex items-start space-x-2 p-2 bg-red-50 border border-red-100 rounded text-red-600 text-[10px]">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="font-medium leading-tight">{frame.error}</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Doc Image Modal */}
      <AnimatePresence>
        {activeImageSelector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setActiveImageSelector(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">문서 이미지 선택</h3>
                <button onClick={() => setActiveImageSelector(null)} className="p-2 hover:bg-slate-100 rounded-full">
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                {docImages.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {docImages.map((url, i) => (
                      <div 
                        key={i} 
                        className="aspect-video rounded-xl overflow-hidden cursor-pointer border-4 border-transparent hover:border-indigo-500 transition-all shadow-sm"
                        onClick={() => handleSelectDocImage(activeImageSelector, url)}
                      >
                        <img src={url} className="w-full h-full object-cover" alt={`DocImg ${i}`} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-slate-500 font-medium">추출된 이미지가 없습니다.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
