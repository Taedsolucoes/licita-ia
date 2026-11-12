import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsBoolean()
  @IsOptional()
  allowPush?: boolean;

  @IsBoolean()
  @IsOptional()
  allowWhatsapp?: boolean;

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'quietHoursStart must be in HH:MM format' })
  quietHoursStart?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'quietHoursEnd must be in HH:MM format' })
  quietHoursEnd?: string;
}

export class RegisterDeviceDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token!: string;

  @IsString()
  @IsIn(['android', 'ios'])
  platform!: 'android' | 'ios';
}

export class UnregisterDeviceDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token!: string;
}
