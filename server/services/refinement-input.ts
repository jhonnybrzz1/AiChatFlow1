import fs from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

export type RefinementInputSource = 'description' | 'document';

export interface RefinementInputResolution {
  ideaText: string;
  refinementInputSource: RefinementInputSource;
  documentText: string;
  documentTextLength: number;
  ideaTextLength: number;
}

export class RefinementInputError extends Error {
  constructor(
    public readonly errorCode: 'DOCUMENT_TEXT_EMPTY',
    message: string
  ) {
    super(message);
    this.name = 'RefinementInputError';
  }
}

export async function extractTextFromUploadedFile(file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname || file.path).toLowerCase();
  const mimeType = file.mimetype || '';

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    const buffer = await fs.readFile(file.path);
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');

    if (!documentXml) {
      return '';
    }

    return documentXml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();
  }

  if (mimeType === 'application/pdf' || ext === '.pdf') {
    const buffer = await fs.readFile(file.path);
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text || '';
    } finally {
      await parser.destroy();
    }
  }

  if (
    mimeType.startsWith('text/') ||
    ['.txt', '.md', '.markdown', '.csv', '.json'].includes(ext)
  ) {
    return fs.readFile(file.path, 'utf8');
  }

  return '';
}

export async function extractTextFromUploadedFiles(files: Express.Multer.File[] = []): Promise<string> {
  const extractedParts: string[] = [];

  for (const file of files) {
    const text = await extractTextFromUploadedFile(file);
    if (text.trim()) {
      extractedParts.push(text.trim());
    }
  }

  return extractedParts.join('\n\n---\n\n').trim();
}

export async function resolveRefinementInput(
  description: string | null | undefined,
  files: Express.Multer.File[] = []
): Promise<RefinementInputResolution> {
  const descriptionText = description?.trim() ?? '';

  if (descriptionText) {
    return {
      ideaText: descriptionText,
      refinementInputSource: 'description',
      documentText: '',
      documentTextLength: 0,
      ideaTextLength: descriptionText.length
    };
  }

  const documentText = await extractTextFromUploadedFiles(files);

  if (!documentText.trim()) {
    throw new RefinementInputError(
      'DOCUMENT_TEXT_EMPTY',
      'A descrição está vazia e não foi possível extrair texto do documento anexado.'
    );
  }

  return {
    ideaText: documentText,
    refinementInputSource: 'document',
    documentText,
    documentTextLength: documentText.length,
    ideaTextLength: documentText.length
  };
}
