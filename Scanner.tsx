import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import Tesseract from 'tesseract.js';
import stringSimilarity from 'string-similarity';
import { Camera, X, Loader2, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';
import { QuizQuestion } from '../services/gemini';

interface ScannerProps {
  quiz: QuizQuestion[];
  onClose: () => void;
}

export function Scanner({ quiz, onClose }: ScannerProps) {
  const webcamRef = useRef<Webcam>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<{
    bestMatch: QuizQuestion;
    confidence: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      setError("Gagal mengambil gambar dari kamera.");
      return;
    }

    setIsScanning(true);
    setError(null);
    setResult(null);

    try {
      // Run OCR using Tesseract (non-AI method)
      const tesseractResult = await Tesseract.recognize(
        imageSrc,
        'ind',
        { logger: m => console.log(m) }
      );

      const scannedText = tesseractResult.data.text.trim();
      
      if (!scannedText || scannedText.length < 5) {
        throw new Error("Tidak ada teks yang terbaca. Pastikan soal masuk ke dalam layar.");
      }

      console.log("Scanned text:", scannedText);

      // Simple string similarity calculation to find best matching question
      const questionTexts = quiz.map(q => q.question);
      const matchRatings = stringSimilarity.findBestMatch(scannedText, questionTexts);
      
      const bestMatchIndex = matchRatings.bestMatchIndex;
      const confidence = matchRatings.bestMatch.rating;

      // Generally, > 0.1 confidence means it might have caught something if text is poorly scanned,
      // but let's be generous
      if (confidence < 0.1) {
        throw new Error("Soal tidak ditemukan di database. Coba scan ulang dengan lebih jelas.");
      }

      setResult({
        bestMatch: quiz[bestMatchIndex],
        confidence
      });

    } catch (err: any) {
      setError(err.message || "Gagal melakukan scan.");
    } finally {
      setIsScanning(false);
    }
  }, [quiz]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 bg-slate-900/80 text-white absolute top-0 w-full z-10 backdrop-blur-sm">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-semibold tracking-wide">Scan Soal</span>
        <div className="w-10"></div> {/* Placeholder for centering */}
      </div>

      {/* Main Scanner View */}
      <div className="relative flex-grow flex items-center justify-center overflow-hidden">
        {result ? (
          <div className="w-full max-w-lg mx-auto p-4 z-10 relative mt-16 animate-in slide-in-from-bottom flex flex-col justify-center h-full">
             <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-xl font-bold text-gray-900 dark:text-white">Soal Ditemukan:</h3>
                 <span className="text-sm font-semibold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full">
                   Kecocokan: {Math.round(result.confidence * 100)}%
                 </span>
               </div>
               <p className="text-slate-700 dark:text-slate-300 mb-6 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                 {result.bestMatch.question}
               </p>

               <div className="space-y-3">
                 <h4 className="font-semibold text-slate-800 dark:text-slate-200 uppercase text-xs tracking-wider">Jawaban Benar:</h4>
                 
                 {result.bestMatch.options.map((opt, i) => {
                   const isCorrect = result.bestMatch.correctAnswerIndices?.includes(i);
                   if (!isCorrect) return null;
                   
                   return (
                     <div key={i} className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl text-emerald-800 dark:text-emerald-300 font-medium">
                       <CheckCircle2 className="w-6 h-6 flex-shrink-0 text-emerald-500" />
                       <span className="leading-relaxed whitespace-pre-wrap">{opt}</span>
                     </div>
                   );
                 })}
               </div>

               <button 
                 onClick={() => setResult(null)} 
                 className="w-full mt-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
               >
                 <RefreshCw className="w-5 h-5" /> Scan Soal Lain
               </button>
             </div>
          </div>
        ) : (
          <>
            {/* @ts-ignore: react-webcam missing props in types */}
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              screenshotQuality={1}
              videoConstraints={{ 
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: "environment" 
              }}
              className="absolute min-w-full min-h-full object-cover"
            />
            
            {/* Dark overlay with transparent center hole */}
            <div className="absolute inset-0 z-10" style={{
              background: 'radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.85) 60%)'
            }} />

            {/* Viewfinder Target box */}
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
               <div className="w-11/12 max-w-sm h-64 border-2 border-indigo-400 rounded-2xl relative shadow-[0_0_20px_rgba(99,102,241,0.5)]">
                 <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-xl"></div>
                 <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-xl"></div>
                 <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-xl"></div>
                 <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-xl"></div>
                 
                 <div className="absolute w-full h-0.5 bg-indigo-500/50 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse pointer-events-none top-1/2 -translate-y-1/2"></div>
               </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="absolute top-24 left-4 right-4 bg-red-500/90 backdrop-blur text-white p-4 rounded-xl text-sm font-medium z-20 text-center shadow-2xl animate-in slide-in-from-top">
                {error}
                <button onClick={() => setError(null)} className="ml-2 underline">Tutup</button>
              </div>
            )}

            {/* Scan Controls */}
            <div className="absolute bottom-12 w-full flex justify-center z-20">
              <button
                onClick={capture}
                disabled={isScanning}
                className="flex flex-col items-center gap-3 disabled:opacity-75 focus:outline-none focus:scale-95 transition-transform"
              >
                <div className="w-20 h-20 bg-white/20 rounded-full border-4 border-white flex items-center justify-center shadow-2xl drop-shadow-2xl">
                  {isScanning ? (
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  ) : (
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                      <Camera className="w-8 h-8 text-slate-900" />
                    </div>
                  )}
                </div>
                <span className="text-white font-medium bg-black/50 px-4 py-1.5 rounded-full backdrop-blur-sm shadow-xl font-mono text-sm tracking-widest uppercase">
                  {isScanning ? "Memproses OCR..." : "Tap Untuk Scan"}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
