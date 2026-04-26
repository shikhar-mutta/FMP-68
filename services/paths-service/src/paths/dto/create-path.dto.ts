import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreatePathDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
