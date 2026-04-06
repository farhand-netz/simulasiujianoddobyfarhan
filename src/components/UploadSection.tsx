import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, BookOpen, Plus, Trash2, Search, Percent } from 'lucide-react';
import { generateQuizFromPdf, generateQuizFromDocx, QuizQuestion } from '../services/gemini';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

interface UploadSectionProps {
  onQuizGenerated: (quiz: QuizQuestion[], materialId?: string) => void;
  isAdmin: boolean;
}

interface Material {
  id: string;
  title: string;
  icon: string;
  url?: string;
  quizData?: string;
}

interface SearchResult {
  question: QuizQuestion;
  materialTitle: string;
  materialIcon: string;
  similarity: number;
}

// Simple bigram similarity function
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 100;
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s1.length < 2 || s2.length < 2) return 0;
  
  const getBigrams = (str: string) => {
    const bg = [];
    for(let i = 0; i < str.length - 1; i++) bg.push(str.slice(i, i+2));
    return bg;
  };
  
  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);
  let intersection = 0;
  const bg2Copy = [...bg2];
  
  for (let i = 0; i < bg1.length; i++) {
    const idx = bg2Copy.indexOf(bg1[i]);
    if (idx > -1) {
      intersection++;
      bg2Copy.splice(idx, 1);
    }
  }
  return Math.round((2.0 * intersection) / (bg1.length + bg2.length) * 100);
}

export function UploadSection({ onQuizGenerated, isAdmin }: UploadSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ title: '', icon: '📚' });
  const [newMaterialFile, setNewMaterialFile] = useState<File | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'materials'), (snapshot) => {
      const materialsData: Material[] = [];
      snapshot.forEach((doc) => {
        materialsData.push({ id: doc.id, ...doc.data() } as Material);
      });
      setMaterials(materialsData);
    }, (err) => {
      console.error("Error fetching materials:", err);
    });

    return () => unsubscribe();
  }, []);

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterial.title || !newMaterialFile) return;
    
    setIsAdding(true);
    setError(null);
    try {
      let quiz: QuizQuestion[];
      if (newMaterialFile.type === 'application/pdf' || newMaterialFile.name.endsWith('.pdf')) {
        quiz = await generateQuizFromPdf(newMaterialFile);
      } else if (newMaterialFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || newMaterialFile.name.endsWith('.docx')) {
        quiz = await generateQuizFromDocx(newMaterialFile);
      } else {
        throw new Error('Unsupported file type.');
      }

      const docRef = await addDoc(collection(db, 'materials'), {
        title: newMaterial.title,
        icon: newMaterial.icon,
        quizData: JSON.stringify(quiz),
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      setNewMaterial({ title: '', icon: '📚' });
      setNewMaterialFile(null);
      
      // Auto-start preview for the newly added material
      onQuizGenerated(quiz, docRef.id);
    } catch (err: any) {
      setError("Failed to add material: " + err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setMaterialToDelete(id);
  };

  const confirmDelete = async () => {
    if (!materialToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'materials', materialToDelete));
      setMaterialToDelete(null);
    } catch (err: any) {
      setError("Failed to delete material: " + err.message);
      setMaterialToDelete(null);
    }
  };

  const handleLibraryClick = (topic: Material) => {
    if (topic.quizData) {
      try {
        const quiz = JSON.parse(topic.quizData);
        onQuizGenerated(quiz, topic.id);
      } catch (e) {
        setError("Failed to load saved quiz data.");
      }
    }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 3) return [];
    
    const results: SearchResult[] = [];
    materials.forEach(material => {
      if (!material.quizData) return;
      try {
        const quiz: QuizQuestion[] = JSON.parse(material.quizData);
        quiz.forEach(q => {
          const similarity = calculateSimilarity(searchQuery, q.question);
          if (similarity > 15) { // Minimum threshold
            results.push({
              question: q,
              materialTitle: material.title,
              materialIcon: material.icon,
              similarity
            });
          }
        });
      } catch (e) {
        // Ignore parse errors for search
      }
    });
    
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, 10); // Top 10 results
  }, [searchQuery, materials]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Pilih Materi Kuis</h2>
        <p className="text-gray-500 dark:text-gray-400">Pilih materi dari library di bawah ini untuk memulai kuis, atau cari pertanyaan.</p>
      </div>

      {/* Search Section */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 transition-colors duration-300">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 dark:text-slate-500" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari pertanyaan dari semua library..."
            className="block w-full pl-11 pr-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white transition-colors duration-300"
          />
        </div>
        
        {searchQuery.length >= 3 && (
          <div className="mt-4 space-y-3">
            <h4 className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Hasil Pencarian</h4>
            {searchResults.length === 0 ? (
              <p className="text-gray-500 dark:text-slate-400 text-sm py-2">Tidak ditemukan pertanyaan yang mirip.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {searchResults.map((result, idx) => {
                  const correctIndices = result.question.correctAnswerIndices || [(result.question as any).correctAnswerIndex];
                  return (
                    <div key={idx} className="p-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl transition-colors duration-300">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{result.question.question}</p>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold whitespace-nowrap">
                          <Percent className="w-3 h-3" /> {result.similarity}%
                        </span>
                      </div>
                      
                      <div className="space-y-1.5 mb-4">
                        {/* Correct Answers */}
                        {result.question.options.map((opt, i) => {
                          if (!correctIndices.includes(i)) return null;
                          return (
                            <div key={`correct-${i}`} className="flex items-start gap-2 text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800 transition-colors duration-300">
                              <span className="font-bold mt-0.5">-</span>
                              <span>{opt}</span>
                            </div>
                          );
                        })}
                        
                        {/* Incorrect Answers */}
                        {result.question.options.map((opt, i) => {
                          if (correctIndices.includes(i)) return null;
                          return (
                            <div key={`wrong-${i}`} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-100 dark:border-red-900/40 transition-colors duration-300">
                              <span className="font-bold mt-0.5">-</span>
                              <span>{opt}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400 transition-colors duration-300">
                        <span>Sumber:</span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md transition-colors duration-300">
                          <span>{result.materialIcon}</span>
                          <span className="font-medium dark:text-slate-300">{result.materialTitle}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pre-loaded Library Section */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 transition-colors duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pilih Materi Tersedia (Library)</h3>
          </div>
          {isAdmin && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Tambah Materi
            </button>
          )}
        </div>
        
        {materials.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 transition-colors duration-300">
            Belum ada materi di library. {isAdmin && "Silakan tambah materi baru."}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {materials.map((topic) => (
              <button
                key={topic.id}
                onClick={() => handleLibraryClick(topic)}
                disabled={loading || isAdding}
                className="relative flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-left group disabled:opacity-50"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform flex-shrink-0">{topic.icon}</span>
                <span className="font-medium text-gray-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 pr-8 transition-colors">{topic.title}</span>
                
                {isAdmin && (
                  <div 
                    onClick={(e) => handleDeleteClick(e, topic.id)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400 py-8">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="font-medium animate-pulse text-lg">Membaca materi dan membuat kuis...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-lg text-red-600 dark:text-red-400 text-sm text-center transition-colors duration-300">
          {error}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {materialToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-xl text-center border border-slate-200 dark:border-slate-800 transition-colors duration-300">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Hapus Materi?</h3>
            <p className="text-gray-500 dark:text-slate-400 mb-6">Apakah Anda yakin ingin menghapus materi ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setMaterialToDelete(null)}
                className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg font-medium flex-1 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex-1 transition-colors shadow-sm"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-200 dark:border-slate-800 transition-colors duration-300">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Tambah Materi Baru</h3>
            <form onSubmit={handleAddMaterial} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Judul Materi</label>
                <input 
                  type="text" 
                  required
                  value={newMaterial.title}
                  onChange={e => setNewMaterial({...newMaterial, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-colors duration-300"
                  placeholder="Contoh: Sejarah Proklamasi"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Icon (Emoji)</label>
                <input 
                  type="text" 
                  required
                  maxLength={2}
                  value={newMaterial.icon}
                  onChange={e => setNewMaterial({...newMaterial, icon: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-colors duration-300"
                  placeholder="📚"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">File Dokumen (PDF/DOCX)</label>
                <input 
                  type="file" 
                  required
                  accept=".pdf,.docx"
                  onChange={e => setNewMaterialFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-colors duration-300"
                />
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Sistem akan mengekstrak soal dari file ini dan menyimpannya ke database.</p>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  disabled={isAdding}
                  className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isAdding || !newMaterialFile}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium transition-colors shadow-sm"
                >
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isAdding ? 'Memproses...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
