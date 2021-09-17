import { DocumentType, User } from '.prisma/client';
import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ChangeCurrentVersionsAPI } from 'src/current-versions/current-versions-api.entity';
import { CurrentVersionsService } from 'src/current-versions/current-versions.service';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { UserService } from 'src/user/user.service';

@Controller('user/versions')
@UseInterceptors(NotFoundInterceptor)
export class UserVersionsController {
  constructor(
    private readonly userService: UserService,
    private readonly currentVersionsService: CurrentVersionsService,
  ) {}

  @Get('accepted-documents')
  @ApiTags('users-versions')
  @UseGuards(JwtAuthGuard)
  async getAcceptStatus(@PrismaUser() user: User) {
    const {
      lastAcceptedPrivacyPolicyVersion,
      lastAcceptedTermsAndConditionsVersion,
    } = user;
    const tAndCVersions = await this.currentVersionsService.get(
      DocumentType.TERMS_AND_CONDITIONS,
    );
    const privacyPolicyVersions = await this.currentVersionsService.get(
      DocumentType.PRIVACY_POLICY,
    );

    const isTermsAndConditionsAccepted =
      lastAcceptedTermsAndConditionsVersion?.getTime() ===
      tAndCVersions.updatedAt?.getTime();
    const isPrivacyPolicyAccepted =
      lastAcceptedPrivacyPolicyVersion?.getTime() ===
      privacyPolicyVersions.updatedAt?.getTime();
    return {
      isTermsAndConditionsAccepted,
      isPrivacyPolicyAccepted,
    };
  }

  @Post('accept')
  @ApiTags('users-versions')
  @UseGuards(JwtAuthGuard)
  async updateVersion(
    @PrismaUser('id') userID: string,
    @Body() body: ChangeCurrentVersionsAPI,
  ) {
    const currentVersions = await this.currentVersionsService.get(
      body.documentType,
    );
    await this.userService.updateUser({
      where: {
        id: userID,
      },
      data: {
        lastAcceptedTermsAndConditionsVersion:
          body.documentType === 'TERMS_AND_CONDITIONS'
            ? currentVersions.updatedAt
            : undefined,
        lastAcceptedPrivacyPolicyVersion:
          body.documentType === 'PRIVACY_POLICY'
            ? currentVersions.updatedAt
            : undefined,
      },
    });
    return {
      message: 'Updated version successfully!',
    };
  }
}
