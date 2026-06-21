/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UploadSection } from './components/UploadSection';
import { QuizPlayer } from './components/QuizPlayer';
import { QuizPreview } from './components/QuizPreview';
import { Scanner } from './components/Scanner';
import { QuizQuestion } from './services/gemini';
import { BrainCircuit, LogIn, LogOut, Loader2, Moon, Sun, AlertTriangle, X, HelpCircle, ExternalLink, Settings, CheckCircle2, Camera } from 'lucide-react';
import { auth, signInWithGoogle, logOut } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function App() {
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [globalQuiz, setGlobalQuiz] = useState<QuizQuestion[] | null>(null);
  const [currentMaterialId, setCurrentMaterialId] = useState<string | null>(null);
  const [appState, setAppState] = useState<'upload' | 'preview' | 'play' | 'scan_global'>('upload');
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [showAuthTroubleshoot, setShowAuthTroubleshoot] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  const isAdmin = user?.email === 'muhammad.farhan.ramadhan.n@gmail.com';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setSignInError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Auth error:", err);
      setSignInError(err?.message || String(err));
      setShowAuthTroubleshoot(true);
    }
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleQuizGenerated = (generatedQuiz: QuizQuestion[], materialId?: string) => {
    setQuiz(generatedQuiz);
    setCurrentMaterialId(materialId || null);
    setAppState('preview');
  };

  const handleRestart = () => {
    setQuiz(null);
    setCurrentMaterialId(null);
    setAppState('upload');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900 selection:text-indigo-900 dark:selection:text-indigo-100 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-[0_0_15px_rgba(79,70,229,0.5)]">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white drop-shadow-sm hover:drop-shadow-[0_0_8px_rgba(99,102,241,0.8)] transition-all duration-300">
              Simulasi Ujian Oppo
            </h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            {loadingAuth ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            ) : user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 hidden sm:block">
                  {user.displayName}
                </span>
                <button 
                  onClick={logOut}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button 
                onClick={handleSignIn}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                Sign In with Google
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow w-full max-w-5xl mx-auto px-4 py-12">
        {appState === 'upload' ? (
          <UploadSection 
            onQuizGenerated={handleQuizGenerated} 
            isAdmin={isAdmin} 
            onGlobalScan={(allQs) => {
              setGlobalQuiz(allQs);
              setAppState('scan_global');
            }}
          />
        ) : appState === 'preview' && quiz ? (
          <QuizPreview 
            quiz={quiz} 
            materialId={currentMaterialId}
            isAdmin={isAdmin}
            onStart={(updatedQuiz) => {
              setQuiz(updatedQuiz);
              setAppState('play');
            }} 
            onCancel={handleRestart} 
          />
        ) : appState === 'play' && quiz ? (
          <QuizPlayer quiz={quiz} onRestart={handleRestart} />
        ) : null}
      </main>

      {appState === 'scan_global' && globalQuiz && (
        <Scanner 
          quiz={globalQuiz} 
          onClose={() => setAppState('upload')} 
        />
      )}

      <footer className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 mt-auto transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 flex flex-col items-center gap-3">
          <p className="text-center text-sm font-medium text-red-600 dark:text-red-500 leading-relaxed">
            Dilarang keras share link website ini karena menyangkut kebijakan internal PT. Selalu Bahagia Sejahtera. <br className="hidden sm:block" />
            Website ini dibuat oleh Farhan dengan tujuan untuk edukasi agar mengingat semua pertanyaan. dengan tanggung jawab yg besar mohon untuk pengertiannya.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-wide">Version 1.2</p>
        </div>
      </footer>

      {/* Troubleshooting Modal for Vercel Google Sign In */}
      {showAuthTroubleshoot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 dark:bg-amber-950 p-2 rounded-xl text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    Solusi Error Google Sign-In
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Langkah-langkah memperbaiki error saat di-deploy di Vercel
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAuthTroubleshoot(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5 text-sm">
              <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 p-4 rounded-xl border border-rose-100 dark:border-rose-900/40 font-mono text-xs break-all">
                <p className="font-semibold mb-1">Detail Error dari Firebase:</p>
                <p className="opacity-90">{signInError || "The requested action is invalid."}</p>
              </div>

              <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Pesan <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-xs">"The requested action is invalid"</code> atau kegagalan login di Vercel biasanya dikarenakan domain Vercel Anda belum didaftarkan di Firebase Auth. Ikuti panduan berikut untuk menyelesaikannya:
              </p>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs mt-0.5">
                    1
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      Daftarkan Vercel Domain di Firebase
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                      Buka <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-0.5">Firebase Console <ExternalLink className="w-3 h-3" /></a>, masuk ke proyek Anda.
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                      Pilih menu <strong>Build</strong> &gt; <strong>Authentication</strong> &gt; tab <strong>Settings</strong> &gt; bagian <strong>Authorized Domains</strong>. Klik tombol <strong>"Add domain"</strong> lalu masukkan domain Vercel Anda (contoh: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-xs">toko-oppo-farhan.vercel.app</code>) dan simpan.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs mt-0.5">
                    2
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      Aktifkan Google Login Provider
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                      Di Firebase Console, buka <strong>Authentication</strong> &gt; tab <strong>Sign-in method</strong>. Klik <strong>"Add new provider"</strong>, pilih <strong>"Google"</strong>, aktifkan statusnya (Enable), pilih email dukung (support email), lalu klik <strong>Save</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs mt-0.5">
                    3
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      Set Environment Variables di Vercel Dashboard
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                      Buka Dashboard Vercel proyek Anda, masuk ke <strong>Settings</strong> &gt; <strong>Environment Variables</strong>. Pastikan Anda telah menambahkan semua variabel dari file <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-xs">.env.example</code> (seperti <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-xs text-indigo-500">VITE_FIREBASE_API_KEY</code>, dsb).
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed mt-1">
                      Setelah menambahkan variabel lingkungan baru di Vercel, jangan lupa untuk melakukan <strong>Redeploy</strong> proyek Anda di Vercel agar nilainya diterapkan ke aplikasi yang aktif!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => setShowAuthTroubleshoot(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
              >
                Tutup Panduan & Coba Lagi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
