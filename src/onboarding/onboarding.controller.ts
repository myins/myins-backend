import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { CreateINSAPI } from 'src/ins/ins-api.entity';
import { InsService } from 'src/ins/ins.service';
import {
  AttachCoverAPI,
  AttachMediaWithClaimTokenAPI,
} from 'src/post/post-api.entity';
import { PostMediaService } from 'src/post/post.media.service';
import { PostService } from 'src/post/post.service';
import { SjwtService } from 'src/sjwt/sjwt.service';
import {
  isVideo,
  photoInterceptor,
  photoOrVideoInterceptor,
} from 'src/util/multer';
import { ClaimINSAPI, CreateGuestPostAPI } from './onboarding-api.entity';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly insService: InsService,
    private readonly postService: PostService,
    private readonly signService: SjwtService,
    private readonly onboardingService: OnboardingService,
    private readonly postMediaService: PostMediaService,
  ) {}

  private readonly logger = new Logger(OnboardingController.name);

  @UseGuards(JwtAuthGuard)
  @Post('claim')
  @ApiTags('onboarding')
  async claimINS(@Body() body: ClaimINSAPI, @PrismaUser('id') userID: string) {
    const { claimToken } = body;

    const decrypted = await this.signService.decrypt(claimToken);
    if (decrypted == null) {
      throw new BadRequestException('Unrecognized claim token!');
    }
    const insID: string = decrypted.sub;

    await this.onboardingService.claimINS(insID, userID);

    return {
      message: 'Claimed successfully!',
    };
  }

  @Post('insAndPost')
  @ApiTags('onboarding')
  async createGuestINS(@Body() body: CreateINSAPI & CreateGuestPostAPI) {
    const { name, content, totalMediaContent } = body;
    const ins = await this.insService.createINS(null, {
      name: name,
    });
    if (!ins) {
      throw new BadRequestException(
        'Could not create ins! Please try again later!',
      );
    }
    const post = await this.postService.createPost({
      content: content,
      totalMediaContent: totalMediaContent,
      inses: {
        connect: [
          {
            id: ins.id,
          },
        ],
      },
    });

    const claimToken = await this.signService.signWithQuickExpiration({
      sub: ins.id,
      phone: '',
    });

    return {
      postID: post.id,
      insID: ins.id,
      claimToken: claimToken,
    };
  }

  @Post('upload')
  @ApiTags('onboarding')
  @UseInterceptors(photoOrVideoInterceptor)
  async attachMediaOnboarding(
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      thumbnail?: Express.Multer.File[];
    },
    @Body() body: AttachMediaWithClaimTokenAPI,
  ) {
    const firstFiles = files.file;
    const thumbnailFiles = files.thumbnail;
    if (!firstFiles) {
      throw new BadRequestException('No file!');
    }
    const file = firstFiles[0];
    const isVideoPost = isVideo(file.originalname);
    if (!file.buffer) {
      throw new BadRequestException('No buffer!');
    }
    if (
      isVideoPost &&
      (!thumbnailFiles || !thumbnailFiles.length || !thumbnailFiles[0].buffer)
    ) {
      throw new BadRequestException('No thumbnail!');
    }

    const setCover = body.setCover === 'true';
    const width = parseInt(body.width);
    const height = parseInt(body.height);
    if (!width || !height) {
      throw new BadRequestException('Invalid width / height!');
    }

    const { claimToken } = body;

    const decrypted = await this.signService.decrypt(claimToken);
    if (decrypted == null) {
      throw new BadRequestException('Unrecognized claim token!');
    }
    const insID: string = decrypted.sub;
    if (!insID) {
      throw new BadRequestException('Nice try!');
    }

    const post = await this.postService.posts({
      where: {
        inses: {
          some: {
            id: insID,
          },
        },
        id: body.postID,
      },
      includeRelatedInfo: false,
    });

    if (!post || post.length == 0) {
      throw new BadRequestException('This is not your post!');
    }

    try {
      return this.postMediaService.attachMediaToPost(
        file,
        thumbnailFiles ? thumbnailFiles[0] : undefined,
        body.postID,
        null,
        {
          width,
          height,
          isVideo: isVideoPost,
          setCover,
        },
      );
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err; // If it's a bad request, just forward it
      } else {
        this.logger.error('Error attaching media to post!');
        this.logger.error(err);
        throw new BadRequestException(`Error creating post! ${err}`);
      }
    }
  }

  @Post('attach-cover')
  @ApiTags('onboarding')
  @UseInterceptors(photoInterceptor)
  async attachCover(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: AttachCoverAPI,
  ) {
    if (!file) {
      throw new BadRequestException('No file!');
    }
    if (!file.buffer) {
      throw new BadRequestException('No buffer!');
    }
    const isVideoPost = isVideo(file.originalname);

    if (isVideoPost) {
      throw new BadRequestException('No posts here!');
    }

    const { claimToken } = body;

    const decrypted = await this.signService.decrypt(claimToken);
    if (decrypted == null) {
      throw new BadRequestException('Unrecognized claim token!');
    }
    const insID: string = decrypted.sub;
    if (!insID) {
      throw new BadRequestException('Nice try!');
    }

    const ins = await this.insService.ins({
      id: insID,
    });

    if (!ins) {
      throw new BadRequestException('This is not your ins!');
    }

    try {
      return this.insService.attachCoverToPost(file, insID);
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err; // If it's a bad request, just forward it
      } else {
        this.logger.error('Error attaching media to post!');
        this.logger.error(err);
        throw new BadRequestException(`Error creating post! ${err}`);
      }
    }
  }
}
