import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  IsBoolean,
} from 'class-validator';

// ─── Tenants ───────────────────────────────────────────────────────────────

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  corporateName: string = '';

  @IsString()
  @IsNotEmpty()
  tradeName: string = '';

  @IsString()
  @Length(14, 18)
  cnpj: string = '';

  @IsString()
  @IsNotEmpty()
  contactName: string = '';

  @IsEmail()
  contactEmail: string = '';

  @IsString()
  @IsNotEmpty()
  contactPhone: string = '';

  @IsString()
  @IsOptional()
  whatsappNumber?: string;

  @IsString()
  @IsOptional()
  planType?: string;
}

export class UpdateTenantDto {
  @IsString()
  @IsOptional()
  corporateName?: string;

  @IsString()
  @IsOptional()
  tradeName?: string;

  @IsString()
  @IsOptional()
  contactName?: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  whatsappNumber?: string;

  @IsString()
  @IsOptional()
  planType?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

// ─── Users ─────────────────────────────────────────────────────────────────

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  fullName: string = '';

  @IsEmail()
  email: string = '';

  @IsString()
  @IsNotEmpty()
  password: string = '';

  @IsEnum(['tenant_owner', 'tenant_user', 'taed_admin', 'taed_operator'])
  role: string = 'tenant_user';

  @IsString()
  @IsOptional()
  phone?: string;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(['tenant_owner', 'tenant_user', 'taed_admin', 'taed_operator'])
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ─── Keywords ──────────────────────────────────────────────────────────────

export class CreateKeywordDto {
  @IsString()
  @IsNotEmpty()
  keyword: string = '';

  @IsEnum(['include', 'exclude'])
  @IsOptional()
  matchType?: string;

  @IsOptional()
  weight?: number;
}

export class UpdateKeywordDto {
  @IsString()
  @IsOptional()
  keyword?: string;

  @IsEnum(['include', 'exclude'])
  @IsOptional()
  matchType?: string;

  @IsOptional()
  weight?: number;
}

// ─── Regions ───────────────────────────────────────────────────────────────

export class CreateRegionDto {
  @IsString()
  @Length(2, 2)
  uf: string = '';

  @IsString()
  @IsOptional()
  municipalityName?: string;

  @IsString()
  @IsOptional()
  municipalityIbgeCode?: string;

  @IsEnum(['uf', 'municipio', 'nacional'])
  scopeType: string = 'uf';
}
