import { IsString, IsNotEmpty } from 'class-validator';

export class CreateFollowRequestDto {
  @IsString()
  @IsNotEmpty()
  pathId!: string;

  @IsString()
  @IsNotEmpty()
  publisherId!: string;
}
