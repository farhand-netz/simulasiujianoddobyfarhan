import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { QuizQuestion } from '../services/gemini';

interface QuizPlayerProps {
  quiz: QuizQuestion[];
  onRestart: () => void;
}

export function QuizPlayer({ quiz, onRestart }: QuizPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const currentQuestion = quiz[currentIndex];
  const correctIndices = currentQuestion.correctAnswerIndices || [(currentQuestion as any).correctAnswerIndex];
  const isMultipleChoice = correctIndices.length > 1;

  const handleToggleAnswer = (index: number) => {
    if (isAnswered) return;
    
    if (isMultipleChoice) {
      setSelectedAnswers(prev => 
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
      );
    } else {
      setSelectedAnswers([index]);
      setIsAnswered(true);
      if (correctIndices.includes(index)) {
        setScore(score + 1);
      }
    }
  };

  const handleSubmitAnswer = () => {
    if (isAnswered || selectedAnswers.length === 0) return;
    
    setIsAnswered(true);
    
    const isCorrect = 
      selectedAnswers.length === correctIndices.length &&
      selectedAnswers.every(i => correctIndices.includes(i));
      
    if (isCorrect) {
      setScore(score + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < quiz.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswers([]);
      setIsAnswered(false);
    } else {
      setIsFinished(true);
      triggerConfetti();
    }
  };

  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults, particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults, particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  if (isFinished) {
    const percentage = Math.round((score / quiz.length) * 100);
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl mx-auto p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 text-center transition-colors duration-300"
      >
        <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Quiz Complete!</h2>
        <div className="text-6xl font-black text-indigo-600 dark:text-indigo-400 mb-6">
          {percentage}%
        </div>
        <p className="text-xl text-gray-600 dark:text-slate-400 mb-8">
          You scored {score} out of {quiz.length} questions correctly.
        </p>
        <button
          onClick={onRestart}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
        >
          <RotateCcw className="w-5 h-5" />
          Create Another Quiz
        </button>
      </motion.div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <span className="px-4 py-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 font-semibold rounded-full text-sm transition-colors">
          Question {currentIndex + 1} of {quiz.length}
        </span>
        <span className="text-gray-500 dark:text-slate-400 font-medium">Score: {score}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 transition-colors duration-300"
        >
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 leading-tight">
            {currentQuestion.question}
          </h3>

          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedAnswers.includes(index);
              const isCorrect = correctIndices.includes(index);
              
              let buttonClass = "w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between ";
              
              if (!isAnswered) {
                buttonClass += isSelected 
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300" 
                  : "border-gray-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 text-gray-700 dark:text-slate-300";
              } else {
                if (isCorrect) {
                  buttonClass += "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300";
                } else if (isSelected) {
                  buttonClass += "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300";
                } else {
                  buttonClass += "border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 text-gray-400 dark:text-slate-600 opacity-60";
                }
              }

              return (
                <button
                  key={index}
                  onClick={() => handleToggleAnswer(index)}
                  disabled={isAnswered}
                  className={buttonClass}
                >
                  <span className="font-medium text-lg">{option}</span>
                  {isAnswered && isCorrect && <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />}
                  {isAnswered && isSelected && !isCorrect && <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {!isAnswered && isMultipleChoice && selectedAnswers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                className="overflow-hidden"
              >
                <div className="flex justify-end">
                  <button
                    onClick={handleSubmitAnswer}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
                  >
                    Submit Answer
                  </button>
                </div>
              </motion.div>
            )}
            {isAnswered && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                className="overflow-hidden"
              >
                <div className="flex justify-end">
                  <button
                    onClick={handleNext}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors shadow-lg"
                  >
                    {currentIndex < quiz.length - 1 ? 'Next Question' : 'Finish Quiz'}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
