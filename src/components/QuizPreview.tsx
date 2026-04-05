import React, { useState } from 'react';
import { QuizQuestion } from '../services/gemini';
import { Play, CheckCircle2, ArrowLeft, Edit2, Save, X, Plus, Trash2, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface QuizPreviewProps {
  quiz: QuizQuestion[];
  materialId?: string | null;
  isAdmin: boolean;
  onStart: (quiz: QuizQuestion[]) => void;
  onCancel: () => void;
}

export function QuizPreview({ quiz: initialQuiz, materialId, isAdmin, onStart, onCancel }: QuizPreviewProps) {
  const [quiz, setQuiz] = useState<QuizQuestion[]>(initialQuiz);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<QuizQuestion | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleEditClick = (index: number) => {
    setEditingIndex(index);
    const q = quiz[index];
    const indices = q.correctAnswerIndices || [(q as any).correctAnswerIndex];
    setEditForm({ ...q, correctAnswerIndices: indices });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditForm(null);
  };

  const handleSaveEdit = async () => {
    if (editingIndex === null || !editForm) return;
    
    setIsSaving(true);
    try {
      const updatedQuiz = [...quiz];
      updatedQuiz[editingIndex] = editForm;
      
      if (materialId) {
        await updateDoc(doc(db, 'materials', materialId), {
          quizData: JSON.stringify(updatedQuiz)
        });
      }
      
      setQuiz(updatedQuiz);
      setEditingIndex(null);
      setEditForm(null);
    } catch (error) {
      console.error("Failed to save edit:", error);
      alert("Gagal menyimpan perubahan.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOptionChange = (optIndex: number, value: string) => {
    if (!editForm) return;
    const newOptions = [...editForm.options];
    newOptions[optIndex] = value;
    setEditForm({ ...editForm, options: newOptions });
  };

  const handleToggleCorrect = (optIndex: number) => {
    if (!editForm) return;
    const currentIndices = editForm.correctAnswerIndices || [];
    let newIndices;
    if (currentIndices.includes(optIndex)) {
      newIndices = currentIndices.filter(i => i !== optIndex);
      if (newIndices.length === 0) newIndices = [optIndex];
    } else {
      newIndices = [...currentIndices, optIndex];
    }
    setEditForm({ ...editForm, correctAnswerIndices: newIndices });
  };

  const handleAddOption = () => {
    if (!editForm) return;
    setEditForm({ ...editForm, options: [...editForm.options, ""] });
  };

  const handleRemoveOption = (optIndex: number) => {
    if (!editForm || editForm.options.length <= 2) return;
    const newOptions = editForm.options.filter((_, i) => i !== optIndex);
    
    let newIndices = (editForm.correctAnswerIndices || [])
      .filter(i => i !== optIndex)
      .map(i => i > optIndex ? i - 1 : i);
      
    if (newIndices.length === 0) newIndices = [0];
    
    setEditForm({ ...editForm, options: newOptions, correctAnswerIndices: newIndices });
  };
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Preview Soal ({quiz.length})</h2>
          <p className="text-gray-500">Periksa soal dan jawaban hasil ekstraksi dokumen sebelum memulai kuis.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button 
            onClick={onCancel} 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
          <button 
            onClick={() => onStart(quiz)} 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors"
          >
            <Play className="w-4 h-4" /> Mulai Kuis
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {quiz.map((q, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            {editingIndex === i && editForm ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pertanyaan</label>
                  <textarea 
                    value={editForm.question}
                    onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pilihan Jawaban (Centang yang benar)</label>
                  <div className="space-y-2">
                    {editForm.options.map((opt, j) => {
                      const isCorrect = editForm.correctAnswerIndices?.includes(j);
                      return (
                        <div key={j} className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggleCorrect(j)}
                            className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center border ${
                              isCorrect ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-transparent hover:border-green-500'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <input 
                            type="text"
                            value={opt}
                            onChange={(e) => handleOptionChange(j, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                          <button 
                            onClick={() => handleRemoveOption(j)}
                            disabled={editForm.options.length <= 2}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button 
                    onClick={handleAddOption}
                    className="mt-3 flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <Plus className="w-4 h-4" /> Tambah Pilihan
                  </button>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button 
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium flex items-center gap-2"
                  >
                    <X className="w-4 h-4" /> Batal
                  </button>
                  <button 
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Simpan
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h3 className="text-lg font-bold text-gray-900 leading-relaxed">
                    {i + 1}. {q.question}
                  </h3>
                  {isAdmin && (
                    <button 
                      onClick={() => handleEditClick(i)}
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex-shrink-0"
                      title="Edit Soal"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {q.options.map((opt, j) => {
                    const isCorrect = q.correctAnswerIndices?.includes(j) || (q as any).correctAnswerIndex === j;
                    return (
                      <div 
                        key={j} 
                        className={`p-3 rounded-xl border ${
                          isCorrect 
                            ? 'bg-green-50 border-green-200 text-green-900 font-medium' 
                            : 'bg-gray-50 border-gray-200 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex gap-3">
                            <span className="font-bold opacity-50">{String.fromCharCode(65 + j)}.</span> 
                            {opt}
                          </span>
                          {isCorrect && <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
