import { GoogleGenAI, Type } from "@google/genai";
import * as mammoth from "mammoth";
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

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
    model: "gemini-3.5-flash",
    contents: `Ekstrak SEMUA (seluruh) pertanyaan dan pilihan jawaban pilihan ganda dari teks kuis berikut. 
SANGAT PENTING: 
1. JANGAN LEWATI SATU PUN PERTANYAAN. Jika teks kuis memiliki nomor urut (contoh: 1, 2, 3, ...), pastikan SEMUA nomor tersebut Anda ambil secara lengkap tanpa ada yang terlewatkan (termasuk nomor 9, 10, dst).
2. Ambil teks pertanyaan dan pilihan jawaban PERSIS SESUAI dengan apa yang tertulis di teks. JANGAN mengubah, memparafrase, atau menambahkan kata-kata Anda sendiri.
3. Petunjuk Kunci Jawaban:
   - Jika kuis berbentuk baris tabel Excel dengan pemisah '|', gunakan baris header (jika ada) atau pola baris untuk menentukan kolom kunci jawaban (misalnya salah satu kolom berisi 'A', 'B', 'C', 'D' yang menunjukkan pilihan yang benar).
   - Jika terdapat tanda [JAWABAN_BENAR] pada pilihan, itu berarti pilihan tersebut adalah jawaban yang benar. Hapus kode [JAWABAN_BENAR] dari teks pilihan jawaban akhir.
   - Pilihan jawaban dalam bahasa Indonesia (sesuaikan jumlahnya dengan dokumen asli, JANGAN tambahkan pilihan kosong).
   - Pastikan correctAnswerIndices berisi indeks dari pilihan yang benar di array options (0-based).
    
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

export async function generateQuizFromSheetText(sheetName: string, text: string): Promise<QuizQuestion[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `Ekstrak SEMUA (seluruh) pertanyaan dan pilihan jawaban dari teks Excel berikut (dari Sheet "${sheetName}").

Teks Excel dapat berupa daftar baris terstruktur dalam format key-value atau dipisahkan oleh pipa '|'.
Setiap baris atau blok data mewakili satu soal, dengan kolom/key seperti Pertanyaan, Jawaban / Kunci, Pilihan A, Pilihan B, Pilihan C, Pilihan D, Pilihan E, dsb.

SANGAT PENTING: 
1. JANGAN LEWATI SATU PUN PERTANYAAN. Ekstrak setiap entri pertanyaan yang ada secara lengkap dari atas sampai bawah. Jangan melompati baris-baris di tengah maupun di bawah.
2. Ambil teks pertanyaan dan pilihan jawaban PERSIS SESUAI dengan apa yang tertulis di teks. JANGAN mengubah, memparafrase, atau menambahkan kata-kata Anda sendiri.
3. Petunjuk Pilihan Jawaban (options):
   - Gabungkan semua pilihan jawaban (misal: Pilihan A, Pilihan B, Pilihan C, Pilihan D, Pilihan E) ke dalam array "options" di JSON.
   - JANGAN memasukkan pilihan kosong atau string kosong.
   - Hapus label pilihan seperti "A.", "B.", "Pilihan A:", atau "A ) " jika ada, agar menyisakan teks bersih.
4. Petunjuk Kunci Jawaban (correctAnswerIndices):
   - Gunakan kolom/key "Jawaban" atau "Kunci" atau "Kunci Jawaban" (berisi huruf seperti A, B, C, D, E atau "Benar" / "Salah") untuk menentukan indeks pilihan yang benar di array options Anda (0-based index: 0 untuk Pilihan A, 1 untuk Pilihan B, 2 untuk Pilihan C, 3 untuk Pilihan D, 4 untuk Pilihan E).
   - Jika ada tanda atau kode "[JAWABAN_BENAR]" di dalam teks suatu pilihan, maka pilihan tersebut adalah jawaban yang benar. Hapus tulisan "[JAWABAN_BENAR]" dari teks pilihan jawaban akhir.
   - Jika nama sheet mengandung kata "Benar Salah" atau "True False", buatlah format pertanyaannya memiliki pilihan jawaban (options) bermakna ["Benar", "Salah"] atau ["True", "False"], lalu set correctAnswerIndices ke indeks yang benar (0 untuk Benar/True, 1 untuk Salah/False).
   - Pastikan "correctAnswerIndices" adalah array angka (indeks 0-based) yang COCOK dengan indeks pilihan di array options yang Anda buat.

Nama Sheet: ${sheetName}
Teks Data Sheet:
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
              description: "Pilihan jawaban (JANGAN tambahkan pilihan kosong. Jika tipe Benar Salah, options berisi ['Benar', 'Salah'])"
            },
            correctAnswerIndices: { 
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: "Array berisi indeks jawaban yang benar di dalam array options (0-based)" 
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
    console.error(`Failed to parse quiz JSON from sheet ${sheetName}`, e);
    return [];
  }
}

function getCellValue(cell: ExcelJS.Cell): string {
  try {
    if (cell.value === null || cell.value === undefined) return '';
    if (typeof cell.value === 'string') return cell.value;
    if (typeof cell.value === 'number') return cell.value.toString();
    if (cell.value instanceof Date) return cell.value.toISOString();
    if (typeof cell.value === 'object') {
      if ((cell.value as any).richText) {
        return (cell.value as any).richText.map((rt: any) => rt.text).join('');
      }
      if ((cell.value as any).formula !== undefined) {
        return (cell.value as any).result?.toString() || (cell.value as any).formula?.toString() || '';
      }
      if ((cell.value as any).text !== undefined) {
        return (cell.value as any).text.toString();
      }
    }
    return String(cell.value);
  } catch (e) {
    console.warn("Failed to stringify cell value:", e);
    return '';
  }
}

function getHeaderColumnType(header: string): string | null {
  const h = header.toLowerCase().replace(/\s+/g, ' ').trim();
  
  if (h.includes('pertanyaan') || h.includes('soal') || h.includes('question') || h.includes('teks') || h.includes('text') || h.includes('deskripsi')) {
    return 'question';
  }
  
  if (h.includes('kunci') || h.includes('jawaban') || h.includes('key') || h.includes('answer') || h.includes('correct')) {
    // Make sure we don't treat option labels like "pilihan jawaban A" as the actual ANSWER column
    if (h.includes('pilihan') || h.includes('opsi') || h.includes('option') || h.includes('pil')) {
      if (!h.includes('kunci') && !h.includes('benar') && !h.includes('pilih_jawaban_benar')) {
        // Skip treating as answer column
      } else {
        return 'jawaban';
      }
    } else {
      return 'jawaban';
    }
  }

  const optionLetters = ['a', 'b', 'c', 'd', 'e'] as const;
  for (const letter of optionLetters) {
    const isOption = 
      h === letter || 
      h === `${letter}.` || 
      h === `${letter})` ||
      h.startsWith(`${letter} `) ||
      h.endsWith(` ${letter}`) ||
      h.includes(`pilihan ${letter}`) ||
      h.includes(`pilihan_${letter}`) ||
      h.includes(`pilihan.${letter}`) ||
      h.includes(`opsi ${letter}`) ||
      h.includes(`opsi_${letter}`) ||
      h.includes(`opsi.${letter}`) ||
      h.includes(`option ${letter}`) ||
      h.includes(`option_${letter}`) ||
      h.includes(`option.${letter}`) ||
      h.includes(`pil ${letter}`) ||
      h.includes(`pil_${letter}`) ||
      h.includes(`pil.${letter}`);
      
    if (isOption) {
      return `option_${letter}`;
    }
  }

  return null;
}

function isExcelJSCellHighlighted(cell: ExcelJS.Cell): boolean {
  try {
    if (cell.fill && cell.fill.type === 'pattern') {
      const fgColor = cell.fill.fgColor;
      if (fgColor) {
        if (fgColor.argb) {
          const argb = fgColor.argb.toUpperCase();
          if (argb !== 'FFFFFFFF' && argb !== '00000000' && argb !== 'FF000000' && !argb.endsWith('FFFFFF')) {
            return true;
          }
        } else if (fgColor.theme !== undefined) {
          return true;
        }
      }
    }
  } catch (e) {}
  return false;
}

function mapAnswerValueToIndices(answerVal: string, options: string[]): number[] {
  const result: number[] = [];
  const val = answerVal.trim().toUpperCase();
  if (!val) return result;

  // Pattern 0: Try to split by delimiters and pull out ALL single letters A-E.
  // This handles multiple correct answers like "A,B,C,D", "A, B, C", "A; B; C", "A B C D", "A/B"
  const parts = val.split(/[\s,;+\/]+/).map(p => p.trim()).filter(p => p.length === 1 && /^[A-E]$/.test(p));
  if (parts.length > 0) {
    const letterMap: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 };
    parts.forEach(letter => {
      const index = letterMap[letter];
      if (index < options.length && !result.includes(index)) {
        result.push(index);
      }
    });
    if (result.length > 0) {
      return result;
    }
  }

  // Pattern 1: Exact letter match at start/boundary like 'A', 'B', 'C', 'D', 'E'
  const patternMatch = val.match(/^([A-E])(\b|[^A-Z]|$)/);
  if (patternMatch) {
    const letter = patternMatch[1];
    const letterMap: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 };
    const index = letterMap[letter];
    if (index < options.length) {
      result.push(index);
      return result;
    }
  }

  // Pattern 1.5: Broad search for any single letter A-E isolated inside string (e.g. "Jawaban: A", "Pilihan C")
  const letterMatch = val.match(/(?:^|[^A-Z])([A-E])(?:$|[^A-Z])/);
  if (letterMatch) {
    const letter = letterMatch[1];
    const letterMap: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 };
    const index = letterMap[letter];
    if (index < options.length) {
      result.push(index);
      return result;
    }
  }

  // Pattern 2: Search if option text matches/contains context of answer
  const foundIdx = options.findIndex(opt => {
    const cleanOpt = opt.toUpperCase().trim();
    return cleanOpt === val || cleanOpt.includes(val) || val.includes(cleanOpt);
  });
  if (foundIdx !== -1) {
    result.push(foundIdx);
    return result;
  }

  // Pattern 3: True/False sheets fallback
  if (options.length === 2) {
    const isTrue = ["BENAR", "TRUE", "B", "T", "1"].some(phrase => val.includes(phrase));
    const isFalse = ["SALAH", "FALSE", "S", "F", "0"].some(phrase => val.includes(phrase));
    if (isTrue) {
      result.push(0);
    } else if (isFalse) {
      result.push(1);
    }
  }

  return result;
}

function tryDirectTypeScriptParse(worksheet: ExcelJS.Worksheet): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const totalRows = worksheet.rowCount;
  if (totalRows === 0) return [];

  let headerRowIndex = -1;
  const colIndices: Record<string, number> = {};

  // Find header row that contains a questions word
  for (let r = 1; r <= Math.min(totalRows, 15); r++) {
    const row = worksheet.getRow(r);
    let isHeader = false;
    const tempCols: Record<string, number> = {};

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const val = getCellValue(cell).trim();
      if (val) {
        const type = getHeaderColumnType(val);
        if (type) {
          tempCols[type] = colNumber;
          if (type === 'question') {
            isHeader = true;
          }
        }
      }
    });

    if (isHeader) {
      headerRowIndex = r;
      Object.assign(colIndices, tempCols);
      break;
    }
  }

  if (headerRowIndex === -1 || !colIndices['question']) {
    return [];
  }

  const optionTypes = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e'];
  const hasOptions = optionTypes.some(type => colIndices[type] !== undefined);
  if (!hasOptions) {
    let optCount = 0;
    const qCol = colIndices['question'];
    const maxCols = worksheet.columnCount || 10;
    for (let c = qCol + 1; c <= maxCols; c++) {
      if (c === colIndices['jawaban']) continue;
      if (optCount < 5) {
        const type = optionTypes[optCount];
        colIndices[type] = c;
        optCount++;
      }
    }
  }

  for (let r = headerRowIndex + 1; r <= totalRows; r++) {
    const row = worksheet.getRow(r);
    const qText = getCellValue(row.getCell(colIndices['question'])).trim();
    if (!qText) continue;

    const options: string[] = [];
    const validColNumbers: number[] = [];

    optionTypes.forEach((type) => {
      const colNum = colIndices[type];
      if (colNum) {
        const cell = row.getCell(colNum);
        const optVal = getCellValue(cell).trim();
        if (optVal) {
          options.push(optVal);
          validColNumbers.push(colNum);
        }
      }
    });

    const sheetLower = worksheet.name.toLowerCase();
    if (options.length === 0 && (sheetLower.includes('benar') || sheetLower.includes('salah') || sheetLower.includes('true') || sheetLower.includes('false'))) {
      options.push("Benar");
      options.push("Salah");
    }

    if (options.length === 0) continue;

    const correctAnswerIndices: number[] = [];

    // Method 1: Check highlighting in option columns
    validColNumbers.forEach((colNum, optIndex) => {
      const cell = row.getCell(colNum);
      if (isExcelJSCellHighlighted(cell)) {
        correctAnswerIndices.push(optIndex);
      }
    });

    // Method 2: Check "Jawaban" column mapping
    if (colIndices['jawaban']) {
      const jawCell = row.getCell(colIndices['jawaban']);
      const jawText = getCellValue(jawCell).trim();
      const mapped = mapAnswerValueToIndices(jawText, options);
      mapped.forEach((idx) => {
        if (!correctAnswerIndices.includes(idx)) {
          correctAnswerIndices.push(idx);
        }
      });
    }

    if (correctAnswerIndices.length === 0) {
      options.forEach((opt, idx) => {
        if (opt.includes('[JAWABAN_BENAR]') && !correctAnswerIndices.includes(idx)) {
          correctAnswerIndices.push(idx);
        }
      });

      if (correctAnswerIndices.length === 0) {
        correctAnswerIndices.push(0);
      }
    }

    const cleanOptions = options.map(opt =>
      opt.replace(' [JAWABAN_BENAR]', '').replace('[JAWABAN_BENAR]', '').trim()
    );

    questions.push({
      question: qText,
      options: cleanOptions,
      correctAnswerIndices
    });
  }

  return questions;
}

function tryDirectTypeScriptParseSheetJS(worksheet: XLSX.WorkSheet, sheetName: string): QuizQuestion[] {
  const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });
  if (rows.length === 0) return [];

  let headerRowIndex = -1;
  const colIndices: Record<string, number> = {};

  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r];
    if (!row) continue;
    let isHeader = false;
    const tempCols: Record<string, number> = {};

    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || '').trim();
      if (val) {
        const type = getHeaderColumnType(val);
        if (type) {
          tempCols[type] = c;
          if (type === 'question') {
            isHeader = true;
          }
        }
      }
    }

    if (isHeader) {
      headerRowIndex = r;
      Object.assign(colIndices, tempCols);
      break;
    }
  }

  if (headerRowIndex === -1 || colIndices['question'] === undefined) {
    return [];
  }

  const optionTypes = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e'];
  const hasOptions = optionTypes.some(type => colIndices[type] !== undefined);
  if (!hasOptions) {
    let optCount = 0;
    const qCol = colIndices['question'];
    const headerRow = rows[headerRowIndex];
    const maxCols = headerRow ? headerRow.length : 10;
    for (let c = qCol + 1; c < maxCols; c++) {
      if (c === colIndices['jawaban']) continue;
      if (optCount < 5) {
        const type = optionTypes[optCount];
        colIndices[type] = c;
        optCount++;
      }
    }
  }

  const questions: QuizQuestion[] = [];

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    const qText = String(row[colIndices['question']] || '').trim();
    if (!qText) continue;

    const options: string[] = [];

    optionTypes.forEach((type) => {
      const colNum = colIndices[type];
      if (colNum !== undefined) {
        const optVal = String(row[colNum] || '').trim();
        if (optVal) {
          options.push(optVal);
        }
      }
    });

    const sheetLower = sheetName.toLowerCase();
    if (options.length === 0 && (sheetLower.includes('benar') || sheetLower.includes('salah') || sheetLower.includes('true') || sheetLower.includes('false'))) {
      options.push("Benar");
      options.push("Salah");
    }

    if (options.length === 0) continue;

    const correctAnswerIndices: number[] = [];

    if (colIndices['jawaban'] !== undefined) {
      const jawText = String(row[colIndices['jawaban']] || '').trim();
      const mapped = mapAnswerValueToIndices(jawText, options);
      mapped.forEach((idx) => {
        if (!correctAnswerIndices.includes(idx)) {
          correctAnswerIndices.push(idx);
        }
      });
    }

    if (correctAnswerIndices.length === 0) {
      options.forEach((opt, idx) => {
        if (opt.includes('[JAWABAN_BENAR]') && !correctAnswerIndices.includes(idx)) {
          correctAnswerIndices.push(idx);
        }
      });

      if (correctAnswerIndices.length === 0) {
        correctAnswerIndices.push(0);
      }
    }

    const cleanOptions = options.map(opt =>
      opt.replace(' [JAWABAN_BENAR]', '').replace('[JAWABAN_BENAR]', '').trim()
    );

    questions.push({
      question: qText,
      options: cleanOptions,
      correctAnswerIndices
    });
  }

  return questions;
}

function parseExcelJSWorksheet(worksheet: ExcelJS.Worksheet): string {
  let sheetText = '';
  const totalRows = worksheet.rowCount;
  const totalCols = worksheet.columnCount;
  
  if (totalRows === 0) return '';
  
  let headerRowIndex = 1;
  let headers: string[] = [];
  
  // Look for header row that mentions questions or answers
  for (let r = 1; r <= Math.min(totalRows, 10); r++) {
    const row = worksheet.getRow(r);
    const rowValues: string[] = [];
    let hasPertanyaan = false;
    
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const val = getCellValue(cell).trim();
      rowValues[colNumber] = val;
      const lower = val.toLowerCase();
      if (lower.includes('pertanyaan') || lower.includes('soal') || lower.includes('question') || lower.includes('jawaban') || lower.includes('pilihan')) {
        hasPertanyaan = true;
      }
    });
    
    if (hasPertanyaan) {
      headerRowIndex = r;
      headers = rowValues;
      break;
    }
  }
  
  // Fallback to first non-empty row if no specific keywords
  if (headers.length === 0) {
    for (let r = 1; r <= totalRows; r++) {
      const row = worksheet.getRow(r);
      const rowValues: string[] = [];
      let hasContent = false;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const val = getCellValue(cell).trim();
        if (val) {
          rowValues[colNumber] = val;
          hasContent = true;
        }
      });
      if (hasContent) {
        headerRowIndex = r;
        headers = rowValues;
        break;
      }
    }
  }
  
  // Generic header names fallback
  if (headers.length === 0) {
    headers = [];
    for (let c = 1; c <= Math.max(totalCols, 12); c++) {
      headers[c] = `Kolom ${String.fromCharCode(64 + c)}`;
    }
  }
  
  // Ensure every read column has a non-empty header representation
  for (let c = 1; c <= Math.max(totalCols, headers.length); c++) {
    if (!headers[c]) {
      headers[c] = `Kolom ${String.fromCharCode(64 + c)}`;
    }
  }
  
  let dataRowsStr = '';
  let validRowCount = 0;
  
  for (let r = headerRowIndex + 1; r <= totalRows; r++) {
    const row = worksheet.getRow(r);
    const rowData: Record<string, string> = {};
    let hasContent = false;
    
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      let val = getCellValue(cell).trim();
      if (val) {
        hasContent = true;
        
        let isHighlighted = false;
        try {
          if (cell.fill && cell.fill.type === 'pattern') {
            const fgColor = cell.fill.fgColor;
            if (fgColor) {
              if (fgColor.argb) {
                const argb = fgColor.argb.toUpperCase();
                if (argb !== 'FFFFFFFF' && argb !== '00000000' && argb !== 'FF000000' && !argb.endsWith('FFFFFF')) {
                  isHighlighted = true;
                }
              } else if (fgColor.theme !== undefined) {
                isHighlighted = true;
              }
            }
          }
        } catch (e) {}
        
        if (isHighlighted) {
          val += ' [JAWABAN_BENAR]';
        }
        
        const key = headers[colNumber] || `Kolom ${String.fromCharCode(64 + colNumber)}`;
        rowData[key] = val;
      }
    });
    
    if (hasContent) {
      dataRowsStr += `- Row ${r}:\n`;
      for (const [key, val] of Object.entries(rowData)) {
        dataRowsStr += `  ${key}: "${val.replace(/"/g, '\\"')}"\n`;
      }
      dataRowsStr += '\n';
      validRowCount++;
    }
  }
  
  if (validRowCount > 0) {
    return `Headers: ${JSON.stringify(headers.filter(Boolean))}\n\nData:\n${dataRowsStr}`;
  }
  return '';
}

function parseSheetJSWorksheet(worksheet: XLSX.WorkSheet): string {
  const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });
  if (rows.length === 0) return '';
  
  let headerRowIndex = 0;
  let headers: string[] = [];
  
  // Find header row with keywords
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r];
    if (!row) continue;
    let hasPertanyaan = false;
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || '').trim();
      const lower = val.toLowerCase();
      if (lower.includes('pertanyaan') || lower.includes('soal') || lower.includes('question') || lower.includes('jawaban') || lower.includes('pilihan')) {
        hasPertanyaan = true;
      }
    }
    if (hasPertanyaan) {
      headerRowIndex = r;
      headers = row.map(v => String(v || '').trim());
      break;
    }
  }
  
  // Fallback if no keywords found in first rows
  if (headers.length === 0) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (row && row.some(v => String(v || '').trim())) {
        headerRowIndex = r;
        headers = row.map(v => String(v || '').trim());
        break;
      }
    }
  }
  
  const maxColsInSheet = Math.max(...rows.map(r => r ? r.length : 0), 12);
  if (headers.length === 0) {
    headers = [];
    for (let c = 0; c < maxColsInSheet; c++) {
      headers[c] = `Kolom ${String.fromCharCode(65 + c)}`;
    }
  }
  
  for (let c = 0; c < Math.max(maxColsInSheet, headers.length); c++) {
    if (!headers[c]) {
      headers[c] = `Kolom ${String.fromCharCode(65 + c)}`;
    }
  }
  
  let dataRowsStr = '';
  let validRowCount = 0;
  
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    
    const rowData: Record<string, string> = {};
    let hasContent = false;
    
    for (let c = 0; c < headers.length; c++) {
      const val = String(row[c] !== undefined ? row[c] : '').trim();
      if (val) {
        hasContent = true;
        rowData[headers[c]] = val;
      }
    }
    
    if (hasContent) {
      dataRowsStr += `- Row ${r + 1}:\n`;
      for (const [key, val] of Object.entries(rowData)) {
        dataRowsStr += `  ${key}: "${val.replace(/"/g, '\\"')}"\n`;
      }
      dataRowsStr += '\n';
      validRowCount++;
    }
  }
  
  if (validRowCount > 0) {
    return `Headers: ${JSON.stringify(headers.filter(Boolean))}\n\nData:\n${dataRowsStr}`;
  }
  return '';
}

export async function generateQuizFromXlsxBuffer(arrayBuffer: ArrayBuffer): Promise<QuizQuestion[]> {
  let allQuestions: QuizQuestion[] = [];
  let combinedExcelText = '';
  
  try {
    // Check file signature to see if it's ZIP (.xlsx is a zip format)
    // A ZIP file starts with 0x50, 0x4B (ASCII for 'PK')
    const uint8 = new Uint8Array(arrayBuffer);
    const isZip = uint8.length >= 2 && uint8[0] === 0x50 && uint8[1] === 0x4B;
    if (!isZip) {
      throw new Error("Not a ZIP file (probably an older .xls binary format)");
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    
    for (const worksheet of workbook.worksheets) {
      // First, try the fast and highly accurate direct TypeScript parsing path
      try {
        const directQuestions = tryDirectTypeScriptParse(worksheet);
        if (directQuestions && directQuestions.length > 0) {
          console.log(`Successfully extracted ${directQuestions.length} questions directly via TypeScript from worksheet: ${worksheet.name}`);
          allQuestions = allQuestions.concat(directQuestions);
          continue; // Skip Gemini LLM call for this sheet since direct parsing succeeded
        }
      } catch (directErr) {
        console.warn(`Direct TypeScript parsing failed for sheet ${worksheet.name}, falling back to Gemini...`, directErr);
      }

      // Fallback: Parse worksheet to string, then send to Gemini
      const sheetText = parseExcelJSWorksheet(worksheet);
      
      if (sheetText.trim().length > 0) {
        console.log(`Processing worksheet via Gemini (ExcelJS): ${worksheet.name}`);
        combinedExcelText += `### Sheet: ${worksheet.name}\n${sheetText}\n\n`;
        try {
          const sheetQuestions = await generateQuizFromSheetText(worksheet.name, sheetText);
          if (sheetQuestions && sheetQuestions.length > 0) {
            allQuestions = allQuestions.concat(sheetQuestions);
          }
        } catch (err) {
          console.error(`Error processing sheet ${worksheet.name} via Gemini:`, err);
        }
      }
    }
  } catch (error) {
    console.warn("ExcelJS failed to load or parse workspace, falling back to XLSX (SheetJS)...", error);
    try {
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];

        // First, try the fast and highly accurate direct TypeScript parsing path for SheetJS
        try {
          const directQuestions = tryDirectTypeScriptParseSheetJS(worksheet, sheetName);
          if (directQuestions && directQuestions.length > 0) {
            console.log(`Successfully extracted ${directQuestions.length} questions directly via SheetJS from worksheet: ${sheetName}`);
            allQuestions = allQuestions.concat(directQuestions);
            continue; // Skip Gemini LLM call for this sheet since direct parsing succeeded
          }
        } catch (directErr) {
          console.warn(`Direct SheetJS parsing failed for sheet ${sheetName}, falling back to Gemini...`, directErr);
        }

        // Fallback: Parse worksheet to string, then send to Gemini
        const sheetText = parseSheetJSWorksheet(worksheet);
        
        if (sheetText.trim().length > 0) {
          console.log(`Processing worksheet via Gemini (SheetJS): ${sheetName}`);
          combinedExcelText += `### Sheet: ${sheetName}\n${sheetText}\n\n`;
          try {
            const sheetQuestions = await generateQuizFromSheetText(sheetName, sheetText);
            if (sheetQuestions && sheetQuestions.length > 0) {
              allQuestions = allQuestions.concat(sheetQuestions);
            }
          } catch (err) {
            console.error(`Error processing sheet ${sheetName} via SheetJS + Gemini:`, err);
          }
        }
      }
    } catch (fallbackError: any) {
      console.error("SheetJS also failed to parse Excel data:", fallbackError);
      throw new Error(`Gagal membaca file Excel (.xlsx atau .xls). Pastikan file tidak rusak dan terformat dengan benar. Detail error: ${fallbackError.message || fallbackError}`);
    }
  }
  
  // If sheet-by-sheet extraction resulted in nothing, run combined extraction fallback
  if (allQuestions.length === 0 && combinedExcelText.trim().length > 0) {
    console.log("No questions extracted sheet-by-sheet. Falling back to combined sheets extraction...");
    try {
      allQuestions = await generateQuizFromText(combinedExcelText);
    } catch (fallbackErr) {
      console.error("Combined spreadsheet extraction fallback failed:", fallbackErr);
    }
  }
  
  if (allQuestions.length === 0) {
    throw new Error("Tidak ada pertanyaan yang berhasil diekstrak dari semua sheet di file Excel. Pastikan file formatnya sesuai, berisi data soal, pilihan ganda, atau benar/salah.");
  }
  
  return allQuestions;
}

export async function generateQuizFromXlsx(file: File): Promise<QuizQuestion[]> {
  const arrayBuffer = await file.arrayBuffer();
  return generateQuizFromXlsxBuffer(arrayBuffer);
}

export async function generateQuizFromImage(file: File): Promise<QuizQuestion[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        const mimeType = file.type;
        
        const ai = getAI();
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [
            {
              inlineData: {
                data: base64Data,
                mimeType
              }
            },
            "Ekstrak SEMUA pertanyaan dan pilihan jawaban pilihan ganda dari gambar ini. SANGAT PENTING: Jangan melewatkan soal apa pun. Jika pertanyaan-pertanyaan tersebut bernomor (contoh: 1 sampai 10), pastikan Anda mengambil SEMUA nomor tanpa terkecuali (terutama jangan sampai melewatkan nomor 9). Ambil teks sesuai aslinya, jangan diubah atau de-paraphrase."
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
                    description: "Pilihan jawaban (sesuaikan jumlahnya dengan gambar asli)"
                  },
                  correctAnswerIndices: { 
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                    description: "Array berisi indeks jawaban yang benar (0-based)" 
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
          resolve(JSON.parse(jsonStr) as QuizQuestion[]);
        } catch (e) {
          console.error("Failed to parse quiz JSON from image", e);
          reject(new Error("Gagal mengurai data kuis dari gambar."));
        }
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function generateQuizFromPdf(file: File): Promise<QuizQuestion[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        
        const ai = getAI();
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [
            {
              inlineData: {
                data: base64Data,
                mimeType: "application/pdf"
              }
            },
            "Ekstrak SEMUA (seluruh) pertanyaan dan pilihan jawaban pilihan ganda dari dokumen PDF ini. SANGAT PENTING: Jangan melewatkan satu pun pertanyaan. Jika soal-soal tersebut bernomor (1, 2, 3...), pastikan Anda mengambil seluruh urutan nomor tersebut secara lengkap (jangan melompati nomor 9 atau nomor lainnya). Ambil teks pertanyaan dan pilihan jawaban PERSIS sesuai dokumen. JANGAN mengubah atau memparafrase."
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
  try {
    const proxyResponse = await fetch(`/api/proxy/html?url=${encodeURIComponent(url)}`);
    if (!proxyResponse.ok) {
      throw new Error(`Proxy error: ${proxyResponse.statusText}`);
    }
    const htmlContent = await proxyResponse.text();

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Ekstrak SEMUA (seluruh) pertanyaan dan pilihan jawaban pilihan ganda dari kode sumber HTML atau teks berikut ini.
Bila ini adalah Google Form, carilah soal pada tag script FB_PUBLIC_LOAD_DATA_ atau pada elemen teks di dalamnya.
      
SANGAT PENTING: 
1. JANGAN LEWATI SATU PUN PERTANYAAN. Jika konten memiliki nomor urut (contoh: 1, 2, 3, ...), pastikan SEMUA nomor tersebut Anda ambil secara lengkap tanpa ada yang terlewat (termasuk nomor 9, 10, dst).
2. Ambil teks pertanyaan dan pilihan jawaban PERSIS SESUAI dengan apa yang tertulis di konten tersebut. 
3. JANGAN mengubah, memparafrase, atau menambahkan kata-kata Anda sendiri pada pertanyaan dan pilihan jawaban.

Konten:
${htmlContent.substring(0, 600000)}`,
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
    return JSON.parse(jsonStr) as QuizQuestion[];
  } catch (e: any) {
    console.error("Failed to parse URL quiz JSON", e);
    throw new Error("Failed to generate quiz from URL: " + e.message);
  }
}
