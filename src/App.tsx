/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UploadSection } from './components/UploadSection';
import { QuizPlayer } from './components/QuizPlayer';
import { QuizPreview } from './components/QuizPreview';
import { QuizQuestion } from './services/gemini';
import { BrainCircuit, LogIn, LogOut, Loader2 } from 'lucide-react';
import { auth, signInWithGoogle, logOut } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function App() {
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [currentMaterialId, setCurrentMaterialId] = useState<string | null>(null);
  const [appState, setAppState] = useState<'upload' | 'preview' | 'play'>('upload');
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const isAdmin = user?.email === 'muhammad.farhan.ramadhan.n@gmail.com';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Simulasi ujian oppo agar lulus semua yaa</h1>
          </div>
          
          <div>
            {loadingAuth ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            ) : user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-600 hidden sm:block">
                  {user.displayName}
                </span>
                <button 
                  onClick={logOut}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button 
                onClick={signInWithGoogle}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors shadow-sm"
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

      <footer className="w-full bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-5xl mx-auto px-4 flex flex-col items-center gap-3">
          <p className="text-center text-sm font-medium text-red-600 leading-relaxed">
            Dilarang keras share link website ini karena menyangkut kebijakan internal PT. Selalu Bahagia Sejahtera. <br className="hidden sm:block" />
            Website ini dibuat oleh Farhan dengan tujuan untuk edukasi agar mengingat semua pertanyaan.
          </p>
          <p className="text-xs text-slate-400 font-medium tracking-wide">Version 1.0</p>
        </div>
      </footer>
    </div>
  );
}
