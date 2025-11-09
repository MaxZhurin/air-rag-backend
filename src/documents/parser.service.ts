import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

@Injectable()
export class ParserService {
  async parseFile(filePath: string, mimeType: string): Promise<string> {
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('File not found');
    }

    switch (mimeType) {
      case 'application/pdf':
        return this.parsePDF(filePath);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.parseDOCX(filePath);
      case 'text/plain':
        return this.parseTXT(filePath);
      case 'text/markdown':
      case 'text/x-markdown':
        return this.parseMD(filePath);
      default:
        // Check file extension as fallback for markdown files
        if (filePath.toLowerCase().endsWith('.md')) {
          return this.parseMD(filePath);
        }
        throw new BadRequestException('Unsupported file type');
    }
  }

  private async parsePDF(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      
      // Check if text was extracted
      if (!data.text || data.text.trim().length === 0) {
        throw new BadRequestException(
          'PDF file does not contain extractable text. The file might be image-based or encrypted.',
        );
      }
      
      return data.text;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      // Handle specific PDF parsing errors
      if (error.message && error.message.includes('Invalid PDF')) {
        throw new BadRequestException(
          'Invalid PDF file. The file may be corrupted or not a valid PDF.',
        );
      }
      
      if (error.message && error.message.includes('encrypted')) {
        throw new BadRequestException(
          'PDF file is encrypted and cannot be parsed. Please provide an unencrypted PDF.',
        );
      }
      
      console.error('Error parsing PDF file:', error);
      throw new BadRequestException(
        `Failed to parse PDF file: ${error.message || 'Unknown error'}`,
      );
    }
  }

  private async parseDOCX(filePath: string): Promise<string> {
    try {
      // Verify file exists and is readable
      if (!fs.existsSync(filePath)) {
        throw new BadRequestException('DOCX file not found');
      }

      // Extract raw text from DOCX (images are automatically ignored by extractRawText)
      const result = await mammoth.extractRawText({ path: filePath });
      
      // Check if text was extracted
      if (!result.value || result.value.trim().length === 0) {
        throw new BadRequestException(
          'DOCX file does not contain extractable text. The file might be empty or contain only images.',
        );
      }

      // Log warnings if there were any issues during parsing
      if (result.messages && result.messages.length > 0) {
        const warnings = result.messages.filter(msg => msg.type === 'warning');
        if (warnings.length > 0) {
          console.warn('DOCX parsing warnings:', warnings.map(w => w.message).join(', '));
        }
      }
      
      return result.value;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      // Handle specific DOCX parsing errors
      if (error.message && error.message.includes('Invalid file')) {
        throw new BadRequestException(
          'Invalid DOCX file. The file may be corrupted or not a valid DOCX document.',
        );
      }

      if (error.message && error.message.includes('not a zip')) {
        throw new BadRequestException(
          'Invalid DOCX file format. DOCX files must be in the Office Open XML format.',
        );
      }

      if (error.code === 'ENOENT') {
        throw new BadRequestException('DOCX file not found');
      }
      
      console.error('Error parsing DOCX file:', error);
      throw new BadRequestException(
        `Failed to parse DOCX file: ${error.message || 'Unknown error'}`,
      );
    }
  }

  private parseTXT(filePath: string): Promise<string> {
    return Promise.resolve(fs.readFileSync(filePath, 'utf-8'));
  }

  private async parseMD(filePath: string): Promise<string> {
    try {
      // Verify file exists and is readable
      if (!fs.existsSync(filePath)) {
        throw new BadRequestException('MD file not found');
      }

      // Read markdown file as text
      const markdownContent = fs.readFileSync(filePath, 'utf-8');
      
      // Check if content exists
      if (!markdownContent || markdownContent.trim().length === 0) {
        throw new BadRequestException(
          'MD file does not contain extractable text. The file might be empty.',
        );
      }

      // Extract plain text from markdown (remove markdown syntax)
      const plainText = this.removeMarkdownSyntax(markdownContent);
      
      // Check if text was extracted after removing markdown syntax
      if (!plainText || plainText.trim().length === 0) {
        throw new BadRequestException(
          'MD file does not contain extractable text after parsing.',
        );
      }

      return plainText;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Handle specific MD parsing errors
      if (error.code === 'ENOENT') {
        throw new BadRequestException('MD file not found');
      }

      if (error.code === 'EACCES') {
        throw new BadRequestException('MD file is not readable');
      }

      console.error('Error parsing MD file:', error);
      throw new BadRequestException(
        `Failed to parse MD file: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Remove markdown syntax and extract plain text
   * Removes headers, bold, italic, links, code blocks, lists, etc.
   */
  private removeMarkdownSyntax(markdown: string): string {
    let text = markdown;

    // Remove code blocks (```code```)
    text = text.replace(/```[\s\S]*?```/g, '');

    // Remove inline code (`code`)
    text = text.replace(/`[^`]*`/g, '');

    // Remove headers (# ## ### etc.)
    text = text.replace(/^#{1,6}\s+(.+)$/gm, '$1');

    // Remove horizontal rules (---)
    text = text.replace(/^---+$/gm, '');

    // Remove links but keep text [text](url) -> text
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

    // Remove images ![alt](url)
    text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '');

    // Remove bold and italic (**text** or *text* or __text__ or _text_)
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    text = text.replace(/\*([^*]+)\*/g, '$1');
    text = text.replace(/__([^_]+)__/g, '$1');
    text = text.replace(/_([^_]+)_/g, '$1');

    // Remove strikethrough (~~text~~)
    text = text.replace(/~~([^~]+)~~/g, '$1');

    // Remove list markers (-, *, 1., etc.)
    text = text.replace(/^[\s]*[-*+]\s+/gm, '');
    text = text.replace(/^[\s]*\d+\.\s+/gm, '');

    // Remove blockquotes (>)
    text = text.replace(/^>\s+/gm, '');

    // Remove tables (| col1 | col2 |)
    text = text.replace(/\|.*\|/g, '');

    // Remove reference-style links [text][ref]
    text = text.replace(/\[([^\]]+)\]\[[^\]]+\]/g, '$1');

    // Remove HTML tags if any
    text = text.replace(/<[^>]+>/g, '');

    // Clean up extra whitespace
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return text;
  }
}


