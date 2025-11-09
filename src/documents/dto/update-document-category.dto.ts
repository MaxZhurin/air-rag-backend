import { IsOptional, IsString, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateDocumentCategoryDto {
  @IsOptional()
  @Transform(({ value }) => {
    // Handle string 'null', empty string, or undefined -> convert to null
    // This handles both JSON string 'null' and actual null value
    if (value === 'null' || value === '' || value === undefined || value === null) {
      return null;
    }
    return value;
  })
  @ValidateIf((o) => o.categoryId !== null && o.categoryId !== undefined)
  @IsString({ message: 'Category ID must be a string' })
  categoryId?: string | null;
}

