import React, { useState, useEffect } from 'react';
import { Loader2, BookOpen, Plus, Trash2 } from 'lucide-react';
import { generateQuizFromPdf, generateQuizFromDocx, QuizQuestion } from '../services/gemini';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';

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

export function UploadSection({ onQuizGenerated, isAdmin }: UploadSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ title: '', icon: '📚' });
  const [newMaterialFile, setNewMaterialFile] = useState<File | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<string | null>(null);

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

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Pilih Materi Kuis</h2>
        <p className="text-gray-500">Pilih materi dari library di bawah ini untuk memulai kuis.</p>
      </div>

      {/* Pre-loaded Library Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">Pilih Materi Tersedia (Library)</h3>
          </div>
          {isAdmin && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <Plus className="w-4 h-4" /> Tambah Materi
            </button>
          )}
        </div>
        
        {materials.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            Belum ada materi di library. {isAdmin && "Silakan tambah materi baru."}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {materials.map((topic) => (
              <button
                key={topic.id}
                onClick={() => handleLibraryClick(topic)}
                disabled={loading || isAdding}
                className="relative flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left group disabled:opacity-50"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform flex-shrink-0">{topic.icon}</span>
                <span className="font-medium text-gray-700 group-hover:text-indigo-700 pr-8">{topic.title}</span>
                
                {isAdmin && (
                  <div 
                    onClick={(e) => handleDeleteClick(e, topic.id)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-100 rounded-md transition-all"
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
        <div className="flex flex-col items-center justify-center text-indigo-600 py-8">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="font-medium animate-pulse text-lg">Membaca materi dan membuat kuis...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm text-center">
          {error}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {materialToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Hapus Materi?</h3>
            <p className="text-gray-500 mb-6">Apakah Anda yakin ingin menghapus materi ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setMaterialToDelete(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium flex-1"
              >
                Batal
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex-1"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Tambah Materi Baru</h3>
            <form onSubmit={handleAddMaterial} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Judul Materi</label>
                <input 
                  type="text" 
                  required
                  value={newMaterial.title}
                  onChange={e => setNewMaterial({...newMaterial, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Contoh: Sejarah Proklamasi"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon (Emoji)</label>
                <input 
                  type="text" 
                  required
                  maxLength={2}
                  value={newMaterial.icon}
                  onChange={e => setNewMaterial({...newMaterial, icon: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="📚"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Dokumen (PDF/DOCX)</label>
                <input 
                  type="file" 
                  required
                  accept=".pdf,.docx"
                  onChange={e => setNewMaterialFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Sistem akan mengekstrak soal dari file ini dan menyimpannya ke database.</p>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  disabled={isAdding}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isAdding || !newMaterialFile}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium"
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
