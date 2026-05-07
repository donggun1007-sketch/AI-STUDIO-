import React, { useState, useRef } from 'react';
import { Upload, FileText, X, Loader2, Pointer } from 'lucide-react';
import mammoth from 'mammoth';
import { AttachedFile, FileData } from '../types';

interface InputSectionProps {
  onPlanGenerate: (text: string, file?: FileData, originalFile?: File) => void;
  isLoading: boolean;
}

export default function InputSection({ onPlanGenerate, isLoading }: InputSectionProps) {
  const [text, setText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    const validExtensions = ['.pdf', '.docx', '.txt', '.md'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      alert("지원되지 않는 파일 형식입니다. (PDF, DOCX, TXT, MD만 가능)");
      return;
    }

    setIsProcessingFile(true);

    try {
      if (fileName.endsWith('.pdf')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = (e.target?.result as string).split(',')[1];
          setAttachedFile({
            name: file.name,
            mimeType: file.type,
            data: base64,
            original: file
          });
          setIsProcessingFile(false);
        };
        reader.readAsDataURL(file);
      } else if (fileName.endsWith('.docx')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          setText(prev => prev + (prev ? '\n\n' : '') + result.value);
          setAttachedFile(null);
          setIsProcessingFile(false);
        };
        reader.readAsArrayBuffer(file);
      } else {
        // txt, md
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setText(prev => prev + (prev ? '\n\n' : '') + content);
          setAttachedFile(null);
          setIsProcessingFile(false);
        };
        reader.readAsText(file);
      }
    } catch (error) {
      console.error("File processing error:", error);
      alert("파일 처리 중 오류가 발생했습니다.");
      setIsProcessingFile(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const removeAttachment = () => {
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isButtonDisabled = (!text.trim() && !attachedFile) || isLoading || isProcessingFile;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-[#A02B93]" id="main-title">원자력교육 AI 영상 자동화 시스템</h1>
        <p className="text-slate-500">사고 분석 문서를 업로드하거나 내용을 입력하여 스토리보드를 생성하세요.</p>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-xl p-8 transition-colors ${
          isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div 
            className="p-4 bg-slate-50 rounded-full cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Pointer className="w-8 h-8 text-slate-400" />
          </div>
          <div className="text-center">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-indigo-600 font-medium hover:underline"
            >
              파일을 선택하거나
            </button>
            <span className="text-slate-500"> 드래그하여 업로드하세요 (PDF, DOCX, TXT, MD)</span>
          </div>
        </div>

        {attachedFile && (
          <div className="mt-4 flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <FileText className="w-5 h-5 text-indigo-500" />
              <span className="text-sm font-medium text-indigo-700">{attachedFile.name}</span>
            </div>
            <button onClick={removeAttachment} className="p-1 hover:bg-indigo-100 rounded-full">
              <X className="w-4 h-4 text-indigo-500" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <textarea
          className="w-full h-64 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none transition-all"
          placeholder={attachedFile ? "파일이 첨부되었습니다. AI에게 추가로 지시할 사항이 있다면 입력하세요." : "추가 지시사항을 작성하세요. 파일을 업로드했다면, 작성하지 않아도 괜찮습니다."}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <button
          className={`w-full py-4 rounded-xl font-bold text-white transition-all transform active:scale-95 flex items-center justify-center space-x-2 ${
            isButtonDisabled ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
          }`}
          disabled={isButtonDisabled}
          onClick={() => onPlanGenerate(text, attachedFile ? { mimeType: attachedFile.mimeType, data: attachedFile.data } : undefined, attachedFile?.original)}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>분석 중...</span>
            </>
          ) : (
            <span>스토리보드 생성 시작</span>
          )}
        </button>
      </div>
    </div>
  );
}
