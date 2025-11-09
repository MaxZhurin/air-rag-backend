import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { Document } from '../entities/document.entity';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
  ) {}

  async getAllCategories(): Promise<
    Array<Category & { deletable: boolean; documentCount: number }>
  > {
    const categories = await this.categoryRepository.find({
      order: { name: 'ASC' },
      relations: ['documents'],
    });

    return categories.map((category) => ({
      ...category,
      documentCount: category.documents?.length || 0,
      deletable: (category.documents?.length || 0) === 0,
    }));
  }

  async getCategoryById(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['documents'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async createCategory(
    name: string,
    description?: string,
  ): Promise<Category & { deletable: boolean; documentCount: number }> {
    // Check if category with this name already exists
    const existingCategory = await this.categoryRepository.findOne({
      where: { name },
    });

    if (existingCategory) {
      throw new ConflictException('Category with this name already exists');
    }

    const category = this.categoryRepository.create({
      name,
      description,
    });

    const savedCategory = await this.categoryRepository.save(category);

    return {
      ...savedCategory,
      documentCount: 0,
      deletable: true,
    };
  }

  async updateCategory(
    id: string,
    name?: string,
    description?: string,
  ): Promise<Category> {
    const category = await this.getCategoryById(id);

    // If name is being changed, check if new name already exists
    if (name && name !== category.name) {
      const existingCategory = await this.categoryRepository.findOne({
        where: { name },
      });

      if (existingCategory) {
        throw new ConflictException('Category with this name already exists');
      }

      category.name = name;
    }

    if (description !== undefined) {
      category.description = description;
    }

    return await this.categoryRepository.save(category);
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.getCategoryById(id);

    // Check if category is used by any documents
    const documentCount = await this.documentRepository.count({
      where: { categoryId: id },
    });

    if (documentCount > 0) {
      throw new BadRequestException(
        `Cannot delete category. It is used by ${documentCount} document(s).`,
      );
    }

    await this.categoryRepository.remove(category);
  }

  async getCategoryWithDeletableInfo(
    id: string,
  ): Promise<Category & { deletable: boolean; documentCount: number }> {
    const category = await this.getCategoryById(id);

    const documentCount = category.documents?.length || 0;

    return {
      ...category,
      documentCount,
      deletable: documentCount === 0,
    };
  }
}


