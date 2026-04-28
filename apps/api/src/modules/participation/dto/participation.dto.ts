import { IsArray, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ParticipationItemDto {
  @IsString()
  @IsNotEmpty()
  biddingItemId: string = '';

  @IsString()
  @IsNotEmpty()
  brand: string = '';

  @IsNumber()
  finalUnitPrice: number = 0;
}

export class UpdateParticipationItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipationItemDto)
  items: ParticipationItemDto[] = [];
}
