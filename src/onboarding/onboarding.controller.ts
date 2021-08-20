import { BadRequestException, Body, Controller, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserID } from 'src/decorators/user-id.decorator';
import { CreateINSAPI } from 'src/ins/ins-api.entity';
import { InsService } from 'src/ins/ins.service';
import { AttachMediaAPI } from 'src/post/post-api.entity';
import { PostMediaService } from 'src/post/post.media.service';
import { PostService } from 'src/post/post.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SjwtService } from 'src/sjwt/sjwt.service';
import { isVideo, photoOrVideoInterceptor } from 'src/util/multer';
import { ClaimINSAPI, CreateGuestPostAPI } from './onboarding-api.entity';

@Controller('onboarding')
export class OnboardingController {
    constructor(
        private readonly insService: InsService,
        private readonly postService: PostService,
        private readonly signService: SjwtService,
        private readonly prismaService: PrismaService,
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
        const ins = await this.prismaService.iNS.findUnique({
            where: {
                id: insID
            },
            include: {
                _count: {
                    select: {
                        members: true
                    }
                }
            }
        })
        if (!ins || ins._count?.members != 0) {
            throw new BadRequestException("Could not find INS!")
        }

        await this.prismaService.$transaction(async (prisma) => {
            // First we connect the user to that INS
            await prisma.iNS.update({
                where: {
                    id: insID
                },
                data: {
                    members: {
                        connect: {
                            id: userID
                        }
                    }
                }
            })
            //Then we also make him the owner of all the posts (should be one post)
            await this.prismaService.post.updateMany({
                where: {
                    inses: {
                        some: {
                            id: ins.id
                        }
                    },
                    authorId: null
                },
                data: {
                    authorId: userID
                }
            })
        })

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

}
