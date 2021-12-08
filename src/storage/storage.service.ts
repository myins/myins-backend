import { Injectable, Logger } from '@nestjs/common';
import { InjectS3, S3 } from 'nestjs-s3';
import { Readable } from 'stream';

export enum StorageContainer {
  profilepictures = 'profilepictures',
  inscovers = 'inscovers',
  posts = 'posts',
  stories = 'stories',
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(@InjectS3() private readonly s3Service: S3) {}

  async uploadFile(file: Express.Multer.File, containerName: StorageContainer) {
    return this.promisePutObject(
      `${containerName}/${file.originalname}`,
      file.buffer,
    );
  }

  async uploadBuffer(
    file: Buffer,
    originalName: string,
    containerName: StorageContainer,
  ) {
    return this.promisePutObject(`${containerName}/${originalName}`, file);
  }

  promisePutObject(
    key: string,
    body: Buffer | Uint8Array | Blob | string | Readable,
  ) {
    const bucket = process.env.DOCUMENTS_BUCKET ?? '';
    return new Promise<string>((resolve, reject) => {
      this.s3Service.putObject(
        {
          ACL: 'bucket-owner-read',
          Bucket: bucket,
          Key: key,
          Body: body,
        },
        (err, data) => {
          if (err) reject(err);
          else if (data) {
            this.logger.log('OK, I put object!');
            const base = process.env.CLOUDFRONT_URL;
            this.logger.log(`URL: ${base}`);
            this.logger.log(`key: ${key}`);
            resolve(`https://${base}/${key}`);
          }
        },
      );
    });
  }
}
