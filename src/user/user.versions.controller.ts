import {
    Controller,
    Get,
    Patch,
    UseGuards,
    UseInterceptors
  } from '@nestjs/common';
  import { ApiTags } from '@nestjs/swagger';
  import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
  import { CurrentVersionsService } from 'src/current-versions/current-versions.service';
  import { PrismaUser } from 'src/decorators/user.decorator';
  import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
  import { UserService } from 'src/user/user.service';
  
  @Controller('user/versions')
  @UseInterceptors(NotFoundInterceptor)
  export class UserVersionsController {
    constructor(
      private readonly userService: UserService,
      private readonly currentVersionsService: CurrentVersionsService
    ) {}
  
    @Get('is-terms-and-conditions-accepted')
    @ApiTags('users')
    @UseGuards(JwtAuthGuard)
    async isTermsAndConditionsAccepted(@PrismaUser('lastAcceptedTermsAndConditionsVersion') lastAcceptedTermsAndConditionsVersion: Date) {
        const currentVersions = await this.currentVersionsService.get()
        const isTermsAndConditionsAccepted = currentVersions ? 
            (lastAcceptedTermsAndConditionsVersion?.getTime() === currentVersions.termsAndConditionsVersion?.getTime()) : false
        return {
            isTermsAndConditionsAccepted: isTermsAndConditionsAccepted
        }
    }
  
    @Get('is-privacy-policy-accepted')
    @ApiTags('users')
    @UseGuards(JwtAuthGuard)
    async isPrivacyPolicyAccepted(@PrismaUser('lastAcceptedPrivacyPolicyVersion') lastAcceptedPrivacyPolicyVersion: Date) {
        const currentVersions = await this.currentVersionsService.get()
        const isPrivacyPolicyAccepted = currentVersions ? 
            (lastAcceptedPrivacyPolicyVersion?.getTime() === currentVersions.privacyPolicyVersion?.getTime()) : false
        return {
            isPrivacyPolicyAccepted: isPrivacyPolicyAccepted
        }
    }

    @Patch('update-terms-and-conditions-version')
    @ApiTags('users')
    @UseGuards(JwtAuthGuard)
    async updateTermsAndConditionsVersion(@PrismaUser('id') userID: string) {
        const currentVersions = await this.currentVersionsService.get()
        await this.userService.updateUser({
            where: {
                id: userID
            },
            data: {
                lastAcceptedTermsAndConditionsVersion: currentVersions?.termsAndConditionsVersion
            }
        })
        return {
            message: "Updated accepted terms and conditions version successfully!"
        }
    }
  
    @Patch('update-privacy-policy-version')
    @ApiTags('users')
    @UseGuards(JwtAuthGuard)
    async updatePrivacyPolicyVersion(@PrismaUser('id') userID: string) {
        const currentVersions = await this.currentVersionsService.get()
        await this.userService.updateUser({
            where: {
                id: userID
            },
            data: {
                lastAcceptedPrivacyPolicyVersion: currentVersions?.privacyPolicyVersion
            }
        })
        return {
            message: "Updated accepted privacy policy version successfully!"
        }
    }
}
  