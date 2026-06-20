import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { MemberRoleEnum } from '../../project-members/project-member.entity';

export class UpdateProjectMemberRoleDto {
  @ApiProperty({ enum: [MemberRoleEnum.MANAGER, MemberRoleEnum.MEMBER] })
  @IsIn([MemberRoleEnum.MANAGER, MemberRoleEnum.MEMBER])
  role!: MemberRoleEnum.MANAGER | MemberRoleEnum.MEMBER;
}
