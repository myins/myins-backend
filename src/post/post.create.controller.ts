import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserID } from 'src/decorators/user-id.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { CreatePostAPI } from './post-api.entity';
import * as fs from 'fs';
import * as uuid from 'uuid';
import { isVideo, photoOrVideoInterceptor } from 'src/util/multer';
import { UserService } from 'src/user/user.service';
import { StorageContainer, StorageService } from 'src/storage/storage.service';
import * as path from 'path';
import { PostService } from './post.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostCreateController {
    constructor(
        private readonly userService: UserService,
        private readonly storageService: StorageService,
        private readonly postService: PostService,
        private readonly prismaService: PrismaService,
    ) { }

    @Post(':id')
    @UseGuards(JwtAuthGuard)
    @ApiTags('posts')
    @UseInterceptors(photoOrVideoInterceptor)
    async attachPhotoToPost(@UploadedFile() file: Express.Multer.File,
        @Param('id') postID: string, @UserID() userID: string, @Body() body: { setCover: boolean }) {

        if (!file) {
            throw new BadRequestException("No file!")
        }
        if (!file.buffer) {
            throw new BadRequestException("No buffer!")
        }
        const isVideoPost = isVideo(file.originalname);
        const { setCover } = body

        try {
            const post = await this.prismaService.post.findUnique({
                where: { id: postID }, include: {
                    inses: {
                        select: {
                            id: true
                        }
                    },
                    _count: {
                        select: {
                            mediaContent: true
                        }
                    }
                }
            })
            if (post == null) {
                throw new BadRequestException("Could not find post!")
            }
            if (post.authorId != userID) {
                throw new BadRequestException("That's not your post!")
            }
            const existingContent = (post._count?.mediaContent ?? 0)
            if (post.totalMediaContent >= existingContent) {
                throw new BadRequestException("There are too many medias attached already!")
            }
            const willBeReadyAfter = existingContent + 1 == post.totalMediaContent

            const ext = path.extname(file.originalname);
            const randomUUID = uuid.v4();

            let x = file;
            x = {
                ...x,
                originalname: `post_${postID}_${randomUUID}${ext}`,
            };
            const dataURL = await this.storageService.uploadFile(
                x,
                StorageContainer.posts,
            );

            const toRet = await this.prismaService.postContent.create({
                data: {
                    isVideo: isVideoPost,
                    content: dataURL,
                    postId: postID,
                }
            })
            await this.prismaService.post.update({
                where: {
                    id: post.id
                },
                data: {
                    totalMediaContent: {
                        increment: 1
                    },
                    pending: willBeReadyAfter ? false : undefined
                }
            })

            if (setCover) {
                for (const eachINS of post.inses) {
                    await this.prismaService.iNS.update({
                        where: eachINS, data: {
                            cover: dataURL
                        }
                    })
                }

            }
            return toRet
        } catch (err) {
            if (err instanceof BadRequestException) {
                throw err; // If it's a bad request, just forward it
            } else {
                console.log(err);
                throw new BadRequestException(`Error creating post! ${err}`);
            }
        }
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiTags('posts')
    async createPost(
        @Body() postData: CreatePostAPI,
        @UserID() userID: string,
    ) {
        if (postData.content == null || postData.content == undefined) {
            throw new BadRequestException("Content must be empty, not missing!")
        }
        if (postData.ins.length == 0) {
            throw new BadRequestException("No inses? How did you even get this far?")
        }
        const user = await this.userService.user({ id: userID });
        if (!user) {
            throw new BadRequestException('Could not find your user!');
        }
        if (!user.phoneNumberVerified) {
            throw new BadRequestException(
                'Please verify your phone before creating posts!',
            );
        }

        return await this.postService.createPost({
            content: postData.content,
            author: {
                connect: {
                    id: userID,
                },
            },
            pending: true,
            totalMediaContent: postData.totalMediaContent,
            inses: {
                connect: postData.ins.map(each => { return { id: each } })
            }
        });
    }

}
