/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UploadSection } from './components/UploadSection';
import { QuizPlayer } from './components/QuizPlayer';
import { QuizPreview } from './components/QuizPreview';
import { QuizQuestion } from './services/gemini';
import { BrainCircuit, LogIn, LogOut, Loader2, Moon, Sun } from 'lucide-react';
import { auth, signInWithGoogle, logOut } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function App() {
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [currentMaterialId, setCurrentMaterialId] = useState<string | null>(null);
  const [appState, setAppState] = useState<'upload' | 'preview' | 'play'>('upload');
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
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
                onClick={signInWithGoogle}
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
          <UploadSection onQuizGenerated={handleQuizGenerated} isAdmin={isAdmin} />
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

      <footer className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 mt-auto transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 flex flex-col items-center gap-3">
          <p className="text-center text-sm font-medium text-red-600 dark:text-red-500 leading-relaxed">
            Dilarang keras share link website ini karena menyangkut kebijakan internal PT. Selalu Bahagia Sejahtera. <br className="hidden sm:block" />
            Website ini dibuat oleh Farhan dengan tujuan untuk edukasi agar mengingat semua pertanyaan. dengan tanggung jawab yg besar mohon untuk pengertiannya.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-wide">Version 1.2</p>
        </div>
      </footer>
    </div>
  );
}
