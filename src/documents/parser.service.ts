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
      default:
        throw new BadRequestException('Unsupported file type');
    }
  }

  private async parsePDF(filePath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  }

  private async parseDOCX(filePath: string): Promise<string> {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  private parseTXT(filePath: string): Promise<string> {
    return Promise.resolve(fs.readFileSync(filePath, 'utf-8'));
  }
}


