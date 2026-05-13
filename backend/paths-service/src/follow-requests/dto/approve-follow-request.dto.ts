import { IsString, IsNotEmpty } from 'class-validator';

export class ApproveFollowRequestDto {
  @IsString()
  @IsNotEmpty()
  pathId!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;
}
