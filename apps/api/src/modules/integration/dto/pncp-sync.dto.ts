import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class PncpSyncDto {
  @Matches(/^\d{8}$/, { message: 'dataInicial deve usar o formato yyyyMMdd.' })
  dataInicial!: string;

  @Matches(/^\d{8}$/, { message: 'dataFinal deve usar o formato yyyyMMdd.' })
  dataFinal!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  codigoModalidadeContratacao!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  codigoModoDisputa?: number;

  @IsOptional()
  @Matches(/^[A-Za-z]{2}$/)
  uf?: string;

  @IsOptional()
  @Matches(/^\d{7}$/)
  codigoMunicipioIbge?: string;

  /** PNCP does not expose an object-text query parameter; this is applied locally per page. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  palavraChave?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(100)
  tamanhoPagina = 50;

  @IsOptional()
  @IsIn(['publicacao', 'atualizacao'])
  dataTipo: 'publicacao' | 'atualizacao' = 'publicacao';

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  incluirItens = false;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxPages?: number;
}
