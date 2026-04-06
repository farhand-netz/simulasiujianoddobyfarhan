import { GoogleGenAI, Type } from "@google/genai";
import * as mammoth from "mammoth";
import ExcelJS from 'exceljs';

let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. AI features will not work.");
    }
    aiInstance = new GoogleGenAI({ apiKey: apiKey || "dummy_key_to_prevent_crash" });
  }
  return aiInstance;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndices: number[];
}

export async function generateQuizFromText(text: string): Promise<QuizQuestion[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Ekstrak SEMUA (seluruh) pertanyaan dan pilihan jawaban pilihan ganda dari teks berikut. Pastikan TIDAK ADA SATU PUN pertanyaan yang terlewat.
SANGAT PENTING: Ambil teks pertanyaan dan pilihan jawaban PERSIS SESUAI dengan apa yang tertulis di teks. JANGAN mengubah, memparafrase, atau menambahkan kata-kata Anda sendiri pada pertanyaan dan pilihan jawaban.
Jika ada tanda [JAWABAN_BENAR] pada suatu pilihan, itu berarti pilihan tersebut adalah jawaban yang benar. Hapus tanda [JAWABAN_BENAR] dari hasil akhir pilihan jawaban.
    
Teks:
${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: "Pertanyaan kuis dalam Bahasa Indonesia" },
            options: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Pilihan jawaban dalam Bahasa Indonesia (sesuaikan jumlahnya dengan dokumen asli, JANGAN tambahkan pilihan kosong)"
            },
            correctAnswerIndices: { 
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: "Array berisi indeks jawaban yang benar di dalam array options (bisa lebih dari satu jika soal memiliki banyak jawaban benar)" 
            }
          },
          required: ["question", "options", "correctAnswerIndices"]
        }
      }
    }
  });

  try {
    let jsonStr = response.text?.trim() || "[]";
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```\n/, "").replace(/\n```$/, "");
    }
    return JSON.parse(jsonStr) as QuizQuestion[];
  } catch (e) {
    console.error("Failed to parse quiz JSON", e);
    throw new Error("Failed to generate quiz from text.");
  }
}

function getCellValue(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'string') return cell.value;
  if (typeof cell.value === 'number') return cell.value.toString();
  if (cell.value instanceof Date) return cell.value.toISOString();
  if ((cell.value as any).richText) {
    return (cell.value as any).richText.map((rt: any) => rt.text).join('');
  }
  if ((cell.value as any).formula) {
    return (cell.value as any).result?.toString() || '';
  }
  return cell.value.toString();
}

export async function generateQuizFromXlsx(file: File): Promise<QuizQuestion[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  let extractedText = '';
  
  workbook.worksheets.forEach(worksheet => {
    worksheet.eachRow((row) => {
      const rowTexts: string[] = [];
      row.eachCell((cell) => {
        let text = getCellValue(cell).trim();
        if (text) {
          let isHighlighted = false;
          if (cell.fill && cell.fill.type === 'pattern' && cell.fill.pattern === 'solid') {
            const fgColor = cell.fill.fgColor;
            if (fgColor && fgColor.argb) {
              const argb = fgColor.argb.toUpperCase();
              // FFFFFFFF is white, 00000000 is transparent. Anything else is considered a highlight (e.g. yellow)
              if (argb !== 'FFFFFFFF' && argb !== '00000000' && argb !== 'FF000000') {
                isHighlighted = true;
              }
            }
          }
          if (isHighlighted) {
            text += ' [JAWABAN_BENAR]';
          }
          rowTexts.push(text);
        }
      });
      if (rowTexts.length > 0) {
        extractedText += rowTexts.join(' | ') + '\n';
      }
    });
    extractedText += '\n---\n';
  });
  
  return generateQuizFromText(extractedText);
}

export async function generateQuizFromPdf(file: File): Promise<QuizQuestion[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        
        const ai = getAI();
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              inlineData: {
                data: base64Data,
                mimeType: "application/pdf"
              }
            },
            "Ekstrak SEMUA (seluruh) pertanyaan dan pilihan jawaban pilihan ganda dari dokumen ini. Pastikan TIDAK ADA SATU PUN pertanyaan yang terlewat. SANGAT PENTING: Ambil teks pertanyaan dan pilihan jawaban PERSIS SESUAI dengan apa yang tertulis di dokumen. JANGAN mengubah, memparafrase, atau menambahkan kata-kata Anda sendiri pada pertanyaan dan pilihan jawaban."
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING, description: "Pertanyaan kuis dalam Bahasa Indonesia" },
                  options: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: "Pilihan jawaban dalam Bahasa Indonesia (sesuaikan jumlahnya dengan dokumen asli, JANGAN tambahkan pilihan kosong)"
                  },
                  correctAnswerIndices: { 
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                    description: "Array berisi indeks jawaban yang benar di dalam array options (bisa lebih dari satu jika soal memiliki banyak jawaban benar)" 
                  }
                },
                required: ["question", "options", "correctAnswerIndices"]
              }
            }
          }
        });

        let jsonStr = response.text?.trim() || "[]";
        if (jsonStr.startsWith("```json")) {
          jsonStr = jsonStr.replace(/^```json\n/, "").replace(/\n```$/, "");
        } else if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.replace(/^```\n/, "").replace(/\n```$/, "");
        }
        resolve(JSON.parse(jsonStr) as QuizQuestion[]);
      } catch (e) {
        console.error("Failed to parse PDF quiz JSON", e);
        reject(new Error("Failed to generate quiz from PDF."));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function generateQuizFromDocx(file: File): Promise<QuizQuestion[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;
        const quiz = await generateQuizFromText(text);
        resolve(quiz);
      } catch (e) {
        console.error("Failed to extract text from DOCX", e);
        reject(new Error("Failed to read DOCX file."));
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export async function generateQuizFromUrl(url: string): Promise<QuizQuestion[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Ekstrak SEMUA (seluruh) pertanyaan dan pilihan jawaban pilihan ganda dari konten URL ini: ${url}. Pastikan TIDAK ADA SATU PUN pertanyaan yang terlewat. SANGAT PENTING: Ambil teks pertanyaan dan pilihan jawaban PERSIS SESUAI dengan apa yang tertulis di konten tersebut. JANGAN mengubah, memparafrase, atau menambahkan kata-kata Anda sendiri pada pertanyaan dan pilihan jawaban.`,
    config: {
      tools: [{ urlContext: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: "Pertanyaan kuis dalam Bahasa Indonesia" },
            options: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Pilihan jawaban dalam Bahasa Indonesia (sesuaikan jumlahnya dengan dokumen asli, JANGAN tambahkan pilihan kosong)"
            },
            correctAnswerIndices: { 
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: "Array berisi indeks jawaban yang benar di dalam array options (bisa lebih dari satu jika soal memiliki banyak jawaban benar)" 
            }
          },
          required: ["question", "options", "correctAnswerIndices"]
        }
      }
    }
  });

  try {
    let jsonStr = response.text?.trim() || "[]";
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```\n/, "").replace(/\n```$/, "");
    }
    return JSON.parse(jsonStr) as QuizQuestion[];
  } catch (e) {
    console.error("Failed to parse URL quiz JSON", e);
    throw new Error("Failed to generate quiz from URL.");
  }
}
