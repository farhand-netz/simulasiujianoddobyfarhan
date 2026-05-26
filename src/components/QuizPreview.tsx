import React, { useState, useMemo } from 'react';
import { QuizQuestion, generateQuizFromPdf, generateQuizFromDocx, generateQuizFromXlsx, generateQuizFromXlsxBuffer, generateQuizFromImage } from '../services/gemini';
import { Play, CheckCircle2, ArrowLeft, Edit2, Save, X, Plus, Trash2, Loader2, Shuffle, Dices, FilePlus } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
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
  
  // New state for pagination and randomization
  const [selectedPart, setSelectedPart] = useState<number | 'all'>('all');
  const [isRandomized, setIsRandomized] = useState(false);
  const [isOptionsRandomized, setIsOptionsRandomized] = useState(false);
  
  // New state for adding more questions
  const [showAddMoreModal, setShowAddMoreModal] = useState(false);
  const [inputType, setInputType] = useState<'file' | 'url'>('file');
  const [newMaterialFile, setNewMaterialFile] = useState<File | null>(null);
  const [newMaterialUrl, setNewMaterialUrl] = useState('');
  const [isAddingMore, setIsAddingMore] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const questionsPerPage = 10;
  const totalParts = Math.ceil(quiz.length / questionsPerPage);

  const handleReshuffle = () => {
    let newQuiz = [...quiz];

    // 1. Shuffle questions if "Soal" randomization is active
    if (isRandomized) {
      for (let i = newQuiz.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newQuiz[i], newQuiz[j]] = [newQuiz[j], newQuiz[i]];
      }
    }

    // 2. Shuffle options if "Jawaban" randomization is active
    if (isOptionsRandomized) {
      newQuiz = newQuiz.map(q => {
        const optionsWithIndices = q.options.map((opt, idx) => ({ opt, originalIdx: idx }));
        const correctIndices = q.correctAnswerIndices || [(q as any).correctAnswerIndex];
        
        // Shuffle options
        for (let i = optionsWithIndices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [optionsWithIndices[i], optionsWithIndices[j]] = [optionsWithIndices[j], optionsWithIndices[i]];
        }

        const newOptions = optionsWithIndices.map(item => item.opt);
        const newCorrectIndices = optionsWithIndices
          .map((item, newIdx) => correctIndices.includes(item.originalIdx) ? newIdx : -1)
          .filter(idx => idx !== -1);

        return {
          ...q,
          options: newOptions,
          correctAnswerIndices: newCorrectIndices
        };
      });
    }

    // 3. Fallback: If neither is active, just shuffle questions by default
    if (!isRandomized && !isOptionsRandomized) {
      for (let i = newQuiz.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newQuiz[i], newQuiz[j]] = [newQuiz[j], newQuiz[i]];
      }
    }

    setQuiz(newQuiz);
  };

  const handleStartQuiz = () => {
    let finalQuiz = [...quiz];
    
    // 1. Slice by part if selected FIRST
    if (selectedPart !== 'all') {
      const startIndex = selectedPart * questionsPerPage;
      finalQuiz = finalQuiz.slice(startIndex, startIndex + questionsPerPage);
    }

    // 2. Randomize question order
    if (isRandomized) {
      for (let i = finalQuiz.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalQuiz[i], finalQuiz[j]] = [finalQuiz[j], finalQuiz[i]];
      }
    }

    // 3. Randomize answer options for each question
    if (isOptionsRandomized) {
      finalQuiz = finalQuiz.map(q => {
        const optionsWithIndices = q.options.map((opt, idx) => ({ opt, originalIdx: idx }));
        const correctIndices = q.correctAnswerIndices || [(q as any).correctAnswerIndex];
        
        // Shuffle options
        for (let i = optionsWithIndices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [optionsWithIndices[i], optionsWithIndices[j]] = [optionsWithIndices[j], optionsWithIndices[i]];
        }

        const newOptions = optionsWithIndices.map(item => item.opt);
        const newCorrectIndices = optionsWithIndices
          .map((item, newIdx) => correctIndices.includes(item.originalIdx) ? newIdx : -1)
          .filter(idx => idx !== -1);

        return {
          ...q,
          options: newOptions,
          correctAnswerIndices: newCorrectIndices
        };
      });
    }
    
    onStart(finalQuiz);
  };

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

  const handleDeleteQuestion = async (index: number) => {
    setIsSaving(true);
    try {
      const updatedQuiz = quiz.filter((_, i) => i !== index);
      
      if (materialId) {
        try {
          await updateDoc(doc(db, 'materials', materialId), {
            quizData: JSON.stringify(updatedQuiz)
          });
        } catch (err: any) {
          handleFirestoreError(err, OperationType.WRITE, `materials/${materialId}`);
        }
      }
      
      setQuiz(updatedQuiz);
      if (editingIndex === index) {
        setEditingIndex(null);
        setEditForm(null);
      } else if (editingIndex !== null && editingIndex > index) {
        setEditingIndex(editingIndex - 1);
      }
      setDeleteConfirmIndex(null);
    } catch (error) {
      console.error("Failed to delete question:", error);
      alert("Gagal menghapus soal.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (editingIndex === null || !editForm) return;
    
    setIsSaving(true);
    try {
      const updatedQuiz = [...quiz];
      updatedQuiz[editingIndex] = editForm;
      
      if (materialId) {
        try {
          await updateDoc(doc(db, 'materials', materialId), {
            quizData: JSON.stringify(updatedQuiz)
          });
        } catch (err: any) {
          handleFirestoreError(err, OperationType.WRITE, `materials/${materialId}`);
        }
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

  const handleAddMoreQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialId) return;
    if (inputType === 'file' && !newMaterialFile) return;
    if (inputType === 'url' && !newMaterialUrl) return;

    setIsAddingMore(true);
    setAddError(null);
    try {
      let newQuestions: QuizQuestion[];
      
      if (inputType === 'url') {
        const proxyResponse = await fetch(`/api/proxy/gsheet?url=${encodeURIComponent(newMaterialUrl)}`);
        if (!proxyResponse.ok) {
          const errorData = await proxyResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Gagal mengunduh Google Sheet.');
        }
        const arrayBuffer = await proxyResponse.arrayBuffer();
        newQuestions = await generateQuizFromXlsxBuffer(arrayBuffer);
      } else if (newMaterialFile) {
        if (newMaterialFile.type === 'application/pdf' || newMaterialFile.name.endsWith('.pdf')) {
          newQuestions = await generateQuizFromPdf(newMaterialFile);
        } else if (newMaterialFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || newMaterialFile.name.endsWith('.docx')) {
          newQuestions = await generateQuizFromDocx(newMaterialFile);
        } else if (newMaterialFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                   newMaterialFile.type === 'application/vnd.ms-excel' || 
                   newMaterialFile.name.endsWith('.xlsx') || 
                   newMaterialFile.name.endsWith('.xls')) {
          newQuestions = await generateQuizFromXlsx(newMaterialFile);
        } else if (newMaterialFile.type.startsWith('image/')) {
          newQuestions = await generateQuizFromImage(newMaterialFile);
        } else {
          throw new Error('Unsupported file type.');
        }
      } else {
        throw new Error('No input provided.');
      }

      // Merge and de-duplicate
      const questionMap = new Map<string, QuizQuestion>();
      
      quiz.forEach(q => questionMap.set(q.question.trim().toLowerCase(), q));
      newQuestions.forEach(q => {
        if (!questionMap.has(q.question.trim().toLowerCase())) {
          questionMap.set(q.question.trim().toLowerCase(), q);
        }
      });
      
      const mergedQuiz = Array.from(questionMap.values());

      try {
        await updateDoc(doc(db, 'materials', materialId), {
          quizData: JSON.stringify(mergedQuiz)
        });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `materials/${materialId}`);
      }

      setQuiz(mergedQuiz);
      setShowAddMoreModal(false);
      setNewMaterialFile(null);
      setNewMaterialUrl('');
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setIsAddingMore(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Preview Soal ({quiz.length})</h2>
          <p className="text-gray-500 dark:text-gray-400">Periksa soal dan jawaban hasil ekstraksi dokumen sebelum memulai kuis.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          {isAdmin && materialId && (
            <button 
              onClick={() => setShowAddMoreModal(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-xl font-medium border border-emerald-100 dark:border-emerald-900/40 transition-colors"
            >
              <FilePlus className="w-4 h-4" /> Tambah Soal
            </button>
          )}
          <button 
            onClick={onCancel} 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
        </div>
      </div>

      {/* Quiz Settings Panel */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-indigo-100 dark:border-indigo-900 bg-indigo-50/30 dark:bg-indigo-950/20">
        <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider mb-4">Pengaturan Kuis</h3>
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            {/* Part Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Pilih Bagian Soal</label>
              <select 
                value={selectedPart} 
                onChange={(e) => setSelectedPart(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none min-w-[180px] text-gray-900 dark:text-white"
              >
                <option value="all">Semua Soal ({quiz.length})</option>
                {Array.from({ length: totalParts }).map((_, i) => {
                  const start = i * questionsPerPage + 1;
                  const end = Math.min((i + 1) * questionsPerPage, quiz.length);
                  return (
                    <option key={i} value={i}>
                      Part {i + 1} (Soal {start} - {end})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Randomize Toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Acak Urutan</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsRandomized(!isRandomized)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm ${
                    isRandomized 
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-medium' 
                      : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-600 dark:text-gray-400'
                  }`}
                  title="Acak urutan soal"
                >
                  <Shuffle className="w-4 h-4" />
                  Soal
                </button>
                <button
                  onClick={() => setIsOptionsRandomized(!isOptionsRandomized)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm ${
                    isOptionsRandomized 
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-medium' 
                      : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-600 dark:text-gray-400'
                  }`}
                  title="Acak urutan pilihan jawaban"
                >
                  <Shuffle className="w-4 h-4" />
                  Jawaban
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={handleReshuffle}
              className="flex items-center justify-center p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all shadow-sm"
              title="Acak urutan soal sekarang"
            >
              <Dices className="w-5 h-5" />
            </button>
            <button 
              onClick={handleStartQuiz} 
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-sm"
            >
              <Play className="w-5 h-5" /> Mulai Kuis
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {quiz.map((q, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800">
            {editingIndex === i && editForm ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pertanyaan</label>
                  <textarea 
                    value={editForm.question || ''}
                    onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pilihan Jawaban (Centang yang benar)</label>
                  <div className="space-y-2">
                    {editForm.options.map((opt, j) => {
                      const isCorrect = editForm.correctAnswerIndices?.includes(j);
                      return (
                        <div key={j} className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggleCorrect(j)}
                            className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center border ${
                              isCorrect ? 'bg-green-500 border-green-500 text-white' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-transparent hover:border-green-500'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <input 
                            type="text"
                            value={opt || ''}
                            onChange={(e) => handleOptionChange(j, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                          <button 
                            onClick={() => handleRemoveOption(j)}
                            disabled={editForm.options.length <= 2}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button 
                    onClick={handleAddOption}
                    className="mt-3 flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                  >
                    <Plus className="w-4 h-4" /> Tambah Pilihan
                  </button>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                  <button 
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg font-medium flex items-center gap-2"
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
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-relaxed">
                    {i + 1}. {q.question}
                  </h3>
                  {isAdmin && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {deleteConfirmIndex === i ? (
                        <div className="flex items-center gap-2 mr-2">
                          <span className="text-sm font-medium text-red-600 dark:text-red-400">Yakin hapus?</span>
                          <button 
                            onClick={() => handleDeleteQuestion(i)}
                            disabled={isSaving}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                          >
                            Ya
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmIndex(null)}
                            disabled={isSaving}
                            className="px-3 py-1 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium disabled:opacity-50"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeleteConfirmIndex(i)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Hapus Soal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      
                      {deleteConfirmIndex !== i && (
                        <button 
                          onClick={() => handleEditClick(i)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          title="Edit Soal"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
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
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-300 font-medium' 
                            : 'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex gap-3">
                            <span className="font-bold opacity-50">{String.fromCharCode(65 + j)}.</span> 
                            {opt}
                          </span>
                          {isCorrect && <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500 flex-shrink-0" />}
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

      {/* Add More Questions Modal */}
      {showAddMoreModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-200 dark:border-slate-800 transition-colors duration-300">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Tambah Soal Baru</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Sistem akan mengekstrak soal baru dari file/URL dan menambahkannya ke library ini tanpa duplikasi.</p>
            
            {addError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddMoreQuestions} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Sumber Materi Baru</label>
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="previewUpdateInputType" 
                      value="file" 
                      checked={inputType === 'file'} 
                      onChange={() => setInputType('file')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-slate-300">Upload File</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="previewUpdateInputType" 
                      value="url" 
                      checked={inputType === 'url'} 
                      onChange={() => setInputType('url')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-slate-300">Link URL (GSheet/GForm)</span>
                  </label>
                </div>

                {inputType === 'file' ? (
                  <input 
                    type="file" 
                    required={inputType === 'file'}
                    accept=".pdf,.docx,.xlsx,.xls,image/*"
                    onChange={e => setNewMaterialFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-colors duration-300"
                  />
                ) : (
                  <input 
                    type="url" 
                    required={inputType === 'url'}
                    value={newMaterialUrl || ''}
                    onChange={e => setNewMaterialUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-colors duration-300"
                    placeholder="https://docs.google.com/spreadsheets/... atau form URL"
                  />
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddMoreModal(false);
                    setNewMaterialFile(null);
                    setNewMaterialUrl('');
                    setAddError(null);
                  }}
                  disabled={isAddingMore}
                  className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isAddingMore || (inputType === 'file' ? !newMaterialFile : !newMaterialUrl)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg font-medium transition-colors shadow-sm"
                >
                  {isAddingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isAddingMore ? 'Memproses...' : 'Tambah Soal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
