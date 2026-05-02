import { IsOptional, IsString, IsNumber, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class OpportunityFiltersDto {
  @IsOptional()
  @IsIn(['new', 'viewed', 'accepted', 'declined', 'expired'])
  status?: string;

  @IsOptional()
  @IsString()
  uf?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxValue?: number;

  @IsOptional()
  @IsString()
  since?: string;

  @IsOptional()
  @IsString()
  until?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateOpportunityStatusDto {
  @IsIn(['viewed', 'accepted', 'declined'])
  status!: string;
}
