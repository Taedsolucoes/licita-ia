import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

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
