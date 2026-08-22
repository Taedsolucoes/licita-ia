import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AlertKeywordInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  keyword: string = '';

  @IsEnum(['include', 'exclude'])
  @IsOptional()
  matchType?: 'include' | 'exclude';

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10)
  weight?: number;
}

export class AlertRegionInputDto {
  @IsString()
  @Length(2, 2)
  uf: string = '';

  @IsString()
  @IsOptional()
  @MaxLength(180)
  municipalityName?: string;

  @IsString()
  @IsOptional()
  @Length(7, 7)
  municipalityIbgeCode?: string;

  @IsEnum(['uf', 'municipio', 'nacional'])
  scopeType: 'uf' | 'municipio' | 'nacional' = 'uf';
}

export class UpdateAlertProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(180)
  municipioBase?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(500)
  raioKm?: number;

  @IsBoolean()
  @IsOptional()
  participaMunicipal?: boolean;

  @IsBoolean()
  @IsOptional()
  participaEstadual?: boolean;

  @IsBoolean()
  @IsOptional()
  participaFederal?: boolean;

  @IsBoolean()
  @IsOptional()
  participaAutarquias?: boolean;

  @IsBoolean()
  @IsOptional()
  modalidadePregao?: boolean;

  @IsBoolean()
  @IsOptional()
  modalidadeDispensa?: boolean;

  @IsBoolean()
  @IsOptional()
  modalidadeOutros?: boolean;

  @IsBoolean()
  @IsOptional()
  notificaEmail?: boolean;

  @IsBoolean()
  @IsOptional()
  notificaWhatsapp?: boolean;

  @IsBoolean()
  @IsOptional()
  notificaPush?: boolean;

  @ValidateNested({ each: true })
  @Type(() => AlertKeywordInputDto)
  @ArrayMaxSize(100)
  @IsOptional()
  keywords?: AlertKeywordInputDto[];

  @ValidateNested({ each: true })
  @Type(() => AlertRegionInputDto)
  @ArrayMaxSize(50)
  @IsOptional()
  regions?: AlertRegionInputDto[];
}
