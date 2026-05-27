import { PartialType } from '@nestjs/mapped-types';
import { CreateGlAccountDto } from './create-gl-account.dto';

export class UpdateGlAccountDto extends PartialType(CreateGlAccountDto) {}
