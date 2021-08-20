import {
    BadRequestException,
    Body,
    Controller, Param,
    Post, UploadedFile,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserID } from 'src/decorators/user-id.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { isVideo, photoOrVideoInterceptor } from 'src/util/multer';
import { AttachMediaAPI, CreatePostAPI } from './post-api.entity';
import { PostMediaService } from './post.media.service';
import { PostService } from './post.service';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostCreateController {
    constructor(
        private readonly userService: UserService,
        private readonly postService: PostService,
        private readonly postMediaService: PostMediaService,
        private readonly prismaService: PrismaService,
    ) { }

    @Post(':id')
    @UseGuards(JwtAuthGuard)
    @ApiTags('posts')
    @UseInterceptors(photoOrVideoInterceptor)
    async attachPhotoToPost(@UploadedFile() file: Express.Multer.File,
        @Param('id') postID: string, @UserID() userID: string, @Body() body: AttachMediaAPI) {

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
            return this.postMediaService.attachMediaToPost(file, postID, userID, {
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

        const mappedINSIDs = postData.ins.map(each => { return { id: each } })

        const inses = (await this.prismaService.iNS.findMany({
            where: {
                members: {
                    some: {
                        id: userID
                    }
                },
            },
            select: {
                id: true
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
                    id: userID,
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
