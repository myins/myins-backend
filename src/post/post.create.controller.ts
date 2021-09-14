import {
    BadRequestException,
    Body,
    Controller, Logger, Param, Post, UploadedFile,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { InsService } from 'src/ins/ins.service';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { isVideo, photoOrVideoInterceptor } from 'src/util/multer';
import { AttachMediaAPI, CreatePostAPI } from './post-api.entity';
import { PostMediaService } from './post.media.service';
import { PostService } from './post.service';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostCreateController {
    constructor(
        private readonly postService: PostService,
        private readonly postMediaService: PostMediaService,
        private readonly insService: InsService,
    ) { }
    private readonly logger = new Logger(PostCreateController.name)

    @Post(':id')
    @UseGuards(JwtAuthGuard)
    @ApiTags('posts')
    @UseInterceptors(photoOrVideoInterceptor)
    async attachPhotoToPost(@UploadedFile() file: Express.Multer.File,
        @Param('id') postID2: string, @PrismaUser('id') userID: string, @Body() body: AttachMediaAPI) {

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
            return this.postMediaService.attachMediaToPost(file, postID2, userID, {
                width,
                height,
                isVideo: isVideoPost,
                setCover,
            })
        } catch (err) {
            if (err instanceof BadRequestException) {
                throw err; // If it's a bad request, just forward it
            } else {
                this.logger.error("Error attaching media to post!")
                this.logger.error(err)

                throw new BadRequestException(`Error creating post! ${err}`);
            }
        }
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiTags('posts')
    async createPost(
        @Body() postData: CreatePostAPI,
        @PrismaUser() user: User,
    ) {
        if (postData.content == null || postData.content == undefined) {
            throw new BadRequestException("Content must be empty, not missing!")
        }
        if (postData.ins.length == 0) {
            throw new BadRequestException("No inses? How did you even get this far?")
        }
        if (!user.phoneNumberVerified) {
            throw new BadRequestException(
                'Please verify your phone before creating posts!',
            );
        }

        const mappedINSIDs = postData.ins.map(each => { return { id: each } })

        const inses = (await this.insService.insesSelectIDs({
            members: {
                some: {
                    userId: user.id
                }
            }
        })).map(each => each.id)

        for (const each of mappedINSIDs) {
            if (!inses.includes(each.id)) {
                throw { message: "You're not allowed to post to that INS!" }
            }
        }

        return await this.postService.createPost({
            content: postData.content,
            author: {
                connect: {
                    id: user.id,
                },
            },
            pending: true,
            totalMediaContent: postData.totalMediaContent,
            inses: {
                connect: mappedINSIDs
            }
        });
    }
}
