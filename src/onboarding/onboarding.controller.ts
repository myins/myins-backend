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
import { AttachMediaWithClaimTokenAPI } from 'src/media/media-api.entity';
import { MediaService } from 'src/media/media.service';
import { AttachCoverAPI } from 'src/post/post-api.entity';
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
    private readonly mediaService: MediaService,
  ) {}

  private readonly logger = new Logger(OnboardingController.name);

  @UseGuards(JwtAuthGuard)
  @Post('claim')
  @ApiTags('onboarding')
  async claimINS(@Body() body: ClaimINSAPI, @PrismaUser('id') userID: string) {
    const { claimToken } = body;

    this.logger.log('Decrypting claim token');
    const decrypted = await this.signService.decrypt(claimToken);
    if (decrypted == null) {
      this.logger.error('Unrecognized claim token!');
      throw new BadRequestException('Unrecognized claim token!');
    }
    const insID: string = decrypted.sub;

    this.logger.log(`Claim ins ${insID} by user ${userID}`);
    await this.onboardingService.claimINS(insID, userID);

    return {
      message: 'Claimed successfully!',
    };
  }

  @Post('insAndPost')
  @ApiTags('onboarding')
  async createGuestINS(@Body() body: CreateINSAPI & CreateGuestPostAPI) {
    const { name, content, totalMediaContent } = body;

    this.logger.log(`Creating ins with name '${name}'`);
    const ins = await this.insService.createINS({
      name: name,
      shareCode: await this.insService.randomCode(),
    });
    if (!ins) {
      this.logger.error('Could not create ins! Please try again later!');
      throw new BadRequestException(
        'Could not create ins! Please try again later!',
      );
    }

    this.logger.log(
      `Creating post for ins ${ins.id} with content '${content}'`,
    );
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

    this.logger.log('Signing with very quick expiration');
    const claimToken = await this.signService.signWithQuickExpiration({
      sub: ins.id,
      phone: '',
    });

    this.logger.log(
      `Successfully created ins ${ins.id} with code ${ins.shareCode} and post ${post.id}`,
    );
    return {
      postID: post.id,
      insID: ins.id,
      shareCode: ins.shareCode,
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
    this.logger.log(`Attach media with claim token to post ${body.postID}`);
    const firstFiles = files.file;
    const thumbnailFiles = files.thumbnail;
    if (!firstFiles) {
      this.logger.error('No file!');
      throw new BadRequestException('No file!');
    }
    const file = firstFiles[0];
    const isVideoPost = isVideo(file.originalname);
    if (!file.buffer) {
      this.logger.error('No buffer!');
      throw new BadRequestException('No buffer!');
    }
    if (
      isVideoPost &&
      (!thumbnailFiles || !thumbnailFiles.length || !thumbnailFiles[0].buffer)
    ) {
      this.logger.error('No thumbnail!');
      throw new BadRequestException('No thumbnail!');
    }

    const setCover = body.setCover === 'true';
    const width = parseInt(body.width);
    const height = parseInt(body.height);
    if (!width || !height) {
      this.logger.error('Invalid width / height!');
      throw new BadRequestException('Invalid width / height!');
    }

    const { claimToken } = body;

    this.logger.log('Decrypting claim token');
    const decrypted = await this.signService.decrypt(claimToken);
    if (decrypted == null) {
      this.logger.error('Unrecognized claim token!');
      throw new BadRequestException('Unrecognized claim token!');
    }
    const insID: string = decrypted.sub;
    if (!insID) {
      this.logger.error('Invalid claim token!');
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
    });

    if (!post || post.length == 0) {
      this.logger.error('This is not your post!');
      throw new BadRequestException('This is not your post!');
    }

    try {
      return this.mediaService.attachMedia(
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
      this.logger.error('Error attaching media to post!');
      this.logger.error(err);
      if (err instanceof BadRequestException) {
        throw err; // If it's a bad request, just forward it
      } else {
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
      this.logger.error('No file!');
      throw new BadRequestException('No file!');
    }
    if (!file.buffer) {
      this.logger.error('No buffer!');
      throw new BadRequestException('No buffer!');
    }
    const isVideoPost = isVideo(file.originalname);

    if (isVideoPost) {
      this.logger.error('No posts here!');
      throw new BadRequestException('No posts here!');
    }

    const { claimToken } = body;

    this.logger.log('Decrypting claim token');
    const decrypted = await this.signService.decrypt(claimToken);
    if (decrypted == null) {
      this.logger.error('Unrecognized claim token!');
      throw new BadRequestException('Unrecognized claim token!');
    }
    const insID: string = decrypted.sub;
    if (!insID) {
      this.logger.error('Invalid claim token!');
      throw new BadRequestException('Nice try!');
    }

    const ins = await this.insService.ins({
      id: insID,
    });

    if (!ins) {
      this.logger.error('This is not your ins!');
      throw new BadRequestException('This is not your ins!');
    }

    try {
      this.logger.log(`Attach cover for ins ${insID}`);
      return this.insService.attachCoverToPost(file, insID);
    } catch (err) {
      this.logger.error('Error attaching media to post!');
      this.logger.error(err);
      if (err instanceof BadRequestException) {
        throw err; // If it's a bad request, just forward it
      } else {
        throw new BadRequestException(`Error creating post! ${err}`);
      }
    }
  }
}
