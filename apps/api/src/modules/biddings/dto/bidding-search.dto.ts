import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class BiddingSearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  uf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  municipalityIbgeCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  municipalityName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  modalityCode?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  modality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sphere?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minValue?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  maxValue?: number;

  @IsOptional()
  @IsDateString()
  publicationFrom?: string;

  @IsOptional()
  @IsDateString()
  publicationTo?: string;

  @IsOptional()
  @IsDateString()
  proposalFrom?: string;

  @IsOptional()
  @IsDateString()
  proposalTo?: string;

  @IsOptional()
  @IsDateString()
  openingFrom?: string;

  @IsOptional()
  @IsDateString()
  openingTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(['publicationDate', 'proposalDueDate', 'estimatedValue', 'createdAt'])
  sortBy?: 'publicationDate' | 'proposalDueDate' | 'estimatedValue' | 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';
}
