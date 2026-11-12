import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CompanyCnaeInputDto {
  @IsString()
  @Length(4, 10)
  code = '';

  @IsString()
  @IsNotEmpty()
  description = '';

  @IsBoolean()
  isPrimary = false;
}

export class CompanyKeywordInputDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  keyword = '';

  @IsIn(['include', 'exclude'])
  matchType: 'include' | 'exclude' = 'include';

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(5)
  weight?: number;
}

export class CompanyRegionInputDto {
  @IsString()
  @Matches(/^(?:[A-Z]{2}|BR)$/)
  uf = '';

  @IsIn(['uf', 'municipio', 'nacional'])
  scopeType: 'uf' | 'municipio' | 'nacional' = 'uf';

  @IsOptional()
  @IsString()
  @Length(1, 120)
  municipalityName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{7}$/)
  municipalityIbgeCode?: string;
}

export class SaveCompanyProfileDto {
  @IsString()
  @Matches(/^[A-Z0-9]{14}$/)
  cnpj = '';

  @IsString()
  @IsNotEmpty()
  @Length(2, 180)
  corporateName = '';

  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  tradeName = '';

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CompanyCnaeInputDto)
  cnaes: CompanyCnaeInputDto[] = [];

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CompanyKeywordInputDto)
  keywords: CompanyKeywordInputDto[] = [];

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CompanyRegionInputDto)
  regions: CompanyRegionInputDto[] = [];
}
