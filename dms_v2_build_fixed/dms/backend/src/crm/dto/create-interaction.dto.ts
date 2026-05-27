import { InteractionChannel } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateInteractionDto {
  @IsEnum(InteractionChannel)
  channel!: InteractionChannel;

  @IsString()
  @MinLength(1)
  summary!: string;

  @IsOptional()
  @IsString()
  detail?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
