import { BadRequestException, Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserID } from 'src/decorators/user-id.decorator';
import { CreateINSAPI } from 'src/ins/ins-api.entity';
import { InsService } from 'src/ins/ins.service';
import { AttachCoverAPI, AttachMediaAPI } from 'src/post/post-api.entity';
import { PostMediaService } from 'src/post/post.media.service';
import { PostService } from 'src/post/post.service';
import { SjwtService } from 'src/sjwt/sjwt.service';
import { isVideo, photoOrVideoInterceptor } from 'src/util/multer';
import { ClaimINSAPI, CreateGuestPostAPI } from './onboarding-api.entity';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
export class OnboardingController {
    constructor(
        private readonly insService: InsService,
        private readonly postService: PostService,
        private readonly signService: SjwtService,
        private readonly onboardingService: OnboardingService,
        private readonly postMediaService: PostMediaService) { }


    @UseGuards(JwtAuthGuard)
    @Post('claim')
    @ApiTags('onboarding')
    async claimINS(@Body() body: ClaimINSAPI, @UserID() userID: string) {
        const { claimToken } = body

        const decrypted = await this.signService.decrypt(claimToken)
        if (decrypted == null) {
            throw new BadRequestException("Unrecognized claim token!")
        }
        const insID: string = decrypted.sub

        await this.onboardingService.claimINS(insID, userID)

        return {
            message: "Claimed successfully!"
        }
    }

    @Post('insAndPost')
    @ApiTags('onboarding')
    async createGuestINS(@Body() body: CreateINSAPI & CreateGuestPostAPI) {
        const { name, content, totalMediaContent } = body
        const ins = await this.insService.createINS(null, {
            name: name
        })
        if (!ins) {
            throw new BadRequestException("Could not create ins! Please try again later!")
        }
        const post = await this.postService.createPost({
            content: content,
            totalMediaContent: totalMediaContent,
            inses: {
                connect: [
                    {
                        id: ins.id
                    }
                ]
            }
        })

        const claimToken = await this.signService.signWithQuickExpiration({
            sub: ins.id,
            phone: ""
        })

        return {
            postID: post.id,
            insID: ins.id,
            claimToken: claimToken
        }
    }

    @Post('attach')
    @ApiTags('onboarding')
    @UseInterceptors(photoOrVideoInterceptor)
    async attachPhotoToPost(@UploadedFile() file: Express.Multer.File,
        @Body() body: AttachMediaAPI) {

        if (!file) {
            throw new BadRequestException("No file!")
        }
        if (!file.buffer) {
            throw new BadRequestException("No buffer!")
        }
        const isVideoPost = isVideo(file.originalname);

        const setCover = (body.setCover === 'true');
        const width = parseInt(body.width)
        const height = parseInt(body.height)
        if (!width || !height) {
            throw new BadRequestException("Invalid width / height!")
        }

        const { claimToken } = body

        const decrypted = await this.signService.decrypt(claimToken)
        if (decrypted == null) {
            throw new BadRequestException("Unrecognized claim token!")
        }
        const insID: string = decrypted.sub
        if (!insID) {
            throw new BadRequestException("Nice try!");
        }

        const post = await this.postService.posts({
            where: {
                inses: {
                    some: {
                        id: insID
                    }
                },
                id: body.postID
            },
            includeUserInfo: false,
        })

        if (!post || post.length == 0) {
            throw new BadRequestException("This is not your post!");
        }

        try {
            return this.postMediaService.attachMediaToPost(file, body.postID, null, {
                width: width,
                height: height,
                isVideo: isVideoPost,
                setCover: setCover
            })
        } catch (err) {
            if (err instanceof BadRequestException) {
                throw err; // If it's a bad request, just forward it
            } else {
                console.log(err);
                throw new BadRequestException(`Error creating post! ${err}`);
            }
        }
    }


    @Post('attach-cover')
    @ApiTags('onboarding')
    @UseInterceptors(photoOrVideoInterceptor)
    async attachCover(@UploadedFile() file: Express.Multer.File,
        @Body() body: AttachCoverAPI) {

        if (!file) {
            throw new BadRequestException("No file!")
        }
        if (!file.buffer) {
            throw new BadRequestException("No buffer!")
        }
        const isVideoPost = isVideo(file.originalname);

        if (isVideoPost) {
            throw new BadRequestException("No posts here!");
        }

        const { claimToken } = body

        const decrypted = await this.signService.decrypt(claimToken)
        if (decrypted == null) {
            throw new BadRequestException("Unrecognized claim token!")
        }
        const insID: string = decrypted.sub
        if (!insID) {
            throw new BadRequestException("Nice try!");
        }

        const ins = await this.insService.ins({
            id: insID,
        })

        if (!ins) {
            throw new BadRequestException("This is not your ins!");
        }

        try {
            return this.postMediaService.attachCoverToPost(file, insID)
        } catch (err) {
            if (err instanceof BadRequestException) {
                throw err; // If it's a bad request, just forward it
            } else {
                console.log(err);
                throw new BadRequestException(`Error creating post! ${err}`);
            }
        }
    }

}
