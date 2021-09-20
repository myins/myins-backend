import { Injectable } from '@nestjs/common';
import { InjectS3, S3 } from 'nestjs-s3';
import { Readable } from 'stream';

export enum StorageContainer {
  profilepictures = 'myins-backend-profilepictures',
  inscovers = 'myins-backend-inscovers',
  posts = 'myins-backend-posts',
}

@Injectable()
export class StorageService {
  constructor(@InjectS3() private readonly s3Service: S3) {}

  async uploadFile(file: Express.Multer.File, containerName: StorageContainer) {
    return this.promisePutObject(containerName, file.originalname, file.buffer);
  }

  async uploadBuffer(
    file: Buffer,
    originalName: string,
    containerName: StorageContainer,
  ) {
    return this.promisePutObject(containerName, originalName, file);
  }

  promisePutObject(
    bucket: StorageContainer,
    key: string,
    body: Buffer | Uint8Array | Blob | string | Readable,
  ) {
    return new Promise<string>((resolve, reject) => {
      this.s3Service.putObject(
        {
          ACL: 'public-read',
          Bucket: bucket,
          Key: key,
          Body: body,
        },
        (err, data) => {
          if (err) reject(err);
          else if (data) {
            let base = `https://${bucket}.s3.amazonaws.com/`
            // if (bucket === StorageContainer.posts) {
            //   if (process.env.CLOUDFRONT_URL) {
            //     base = process.env.CLOUDFRONT_URL
            //   }
            // }
            resolve(`${base}${key}`);
          }
        },
      );
    });
  }
}
