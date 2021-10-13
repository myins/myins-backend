import { DocumentType, User } from '.prisma/client';
import {
  Body,
  Controller,
  Get,
  Logger,
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
  private readonly logger = new Logger(UserVersionsController.name);

  constructor(
    private readonly userService: UserService,
    private readonly currentVersionsService: CurrentVersionsService,
  ) {}

  @Get('accepted-documents')
  @ApiTags('users-versions')
  @UseGuards(JwtAuthGuard)
  async getAcceptStatus(@PrismaUser() user: User) {
    this.logger.log(
      `Getting status for last accepted versions of TC and PP for user ${user.id}`,
    );
    const {
      lastAcceptedPrivacyPolicyVersion,
      lastAcceptedTermsAndConditionsVersion,
    } = user;

    this.logger.log('Getting current versions of TC and PP');
    const tAndCVersions = await this.currentVersionsService.getByType({
      type: DocumentType.TERMS_AND_CONDITIONS,
    });
    const privacyPolicyVersions = await this.currentVersionsService.getByType({
      type: DocumentType.PRIVACY_POLICY,
    });

    this.logger.log(
      `Checking if user ${user.id} has accepted current versions and return the result`,
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
    this.logger.log(
      `Accepting last version of document type ${body.documentType} by user ${userID}`,
    );

    this.logger.log(
      `Getting current version of document type ${body.documentType}`,
    );
    const currentVersions = await this.currentVersionsService.getByType({
      type: body.documentType,
    });

    this.logger.log(
      `Updating user ${userID}. Set last accepted version of document type ${body.documentType}`,
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

    this.logger.log('Updated version successfully');
    return {
      message: 'Updated version successfully!',
    };
  }
}
