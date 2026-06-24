import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import Tesseract from 'tesseract.js';
import stringSimilarity from 'string-similarity';
import { Camera, X, Loader2, ArrowLeft, RefreshCw, CheckCircle2, Search, Check } from 'lucide-react';
import { QuizQuestion } from '../services/gemini';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ScannerProps {
  quiz: QuizQuestion[];
  onClose: () => void;
}

export function Scanner({ quiz, onClose }: ScannerProps) {
  const webcamRef = useRef<Webcam>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedText, setScannedText] = useState<string | null>(null);
  
  // Crop states
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const [result, setResult] = useState<{
    bestMatch: QuizQuestion;
    confidence: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      setError("Gagal mengambil gambar dari kamera.");
      return;
    }

    setCapturedImage(imageSrc);
    setError(null);
    setResult(null);
    setScannedText(null);
    setCrop(undefined);
  }, []);

  const processImage = async () => {
    if (!capturedImage || !imgRef.current) return;
    
    setIsScanning(true);
    setError(null);

    try {
      let finalBase64 = capturedImage;
      
      if (completedCrop && completedCrop.width && completedCrop.height) {
        const canvas = document.createElement('canvas');
        const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
        const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
        
        canvas.width = completedCrop.width * scaleX;
        canvas.height = completedCrop.height * scaleY;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(
            imgRef.current,
            completedCrop.x * scaleX,
            completedCrop.y * scaleY,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY,
            0,
            0,
            canvas.width,
            canvas.height
          );
          finalBase64 = canvas.toDataURL('image/jpeg');
        }
      }

      // Run OCR using Tesseract (non-AI method)
      const tesseractResult = await Tesseract.recognize(
        finalBase64,
        'ind',
        { logger: m => console.log(m) }
      );

      const text = tesseractResult.data.text.trim();
      
      if (!text || text.length < 5) {
        throw new Error("Tidak ada teks yang terbaca. Pastikan area pemotongan pas di teks soal.");
      }

      console.log("Scanned text:", text);
      setScannedText(text);
      setCapturedImage(null);

    } catch (err: any) {
      setError(err.message || "Gagal melakukan scan.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleSearch = () => {
    if (!scannedText) return;
    
    setError(null);
    
    try {
      // Simple string similarity calculation to find best matching question
      const questionTexts = quiz.map(q => q.question);
      const matchRatings = stringSimilarity.findBestMatch(scannedText, questionTexts);
      
      const bestMatchIndex = matchRatings.bestMatchIndex;
      const confidence = matchRatings.bestMatch.rating;

      // Generally, > 0.1 confidence means it might have caught something if text is poorly scanned
      if (confidence < 0.1) {
        throw new Error("Soal tidak ditemukan di database. Coba scan ulang atau edit teks agar lebih relevan.");
      }

      setResult({
        bestMatch: quiz[bestMatchIndex],
        confidence
      });
      setScannedText(null);
    } catch (err: any) {
      setError(err.message || "Gagal melakukan pencarian.");
    }
  };

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
      <div className="relative flex-grow flex items-center justify-center overflow-hidden bg-black">
        {isScanning ? (
          <div className="z-20 flex flex-col items-center gap-4 animate-in fade-in">
             <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
             <p className="text-white font-medium tracking-wide">Memproses Gambar...</p>
          </div>
        ) : capturedImage && scannedText === null && !result ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black z-20 absolute inset-0 pt-16 pb-6">
            <div className="flex-grow flex items-center justify-center overflow-hidden p-4 w-full relative">
               <p className="absolute top-4 text-white/70 text-sm font-medium z-10">Sesuaikan area pada soal</p>
               <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                className="max-w-full max-h-full"
              >
                <img 
                  ref={imgRef} 
                  src={capturedImage} 
                  alt="Crop" 
                  className="max-w-full max-h-[65vh] object-contain rounded-lg" 
                />
              </ReactCrop>
            </div>
            
            <div className="flex gap-4 px-6 w-full max-w-sm shrink-0">
              <button
                onClick={() => setCapturedImage(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
              >
                Foto Ulang
              </button>
              <button
                onClick={processImage}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <Check className="w-5 h-5" /> Lanjut
              </button>
            </div>
          </div>
        ) : scannedText !== null && !result ? (
          <div className="w-full max-w-lg mx-auto p-4 z-10 relative mt-16 animate-in slide-in-from-bottom flex flex-col justify-center h-full">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Edit Teks Hasil Scan:</h3>
              <textarea
                value={scannedText}
                onChange={(e) => setScannedText(e.target.value)}
                className="w-full h-40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 mb-6 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
              />
              
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setScannedText(null);
                    setError(null);
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSearch}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                >
                  <Search className="w-5 h-5" /> Cari Soal
                </button>
              </div>
            </div>
          </div>
        ) : result ? (
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
