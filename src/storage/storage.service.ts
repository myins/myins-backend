import { Injectable } from '@nestjs/common';
import { InjectS3, S3 } from 'nestjs-s3';
import { Readable } from 'stream';

export enum StorageContainer {
  profilepictures = 'profilepictures',
  inscovers = 'inscovers',
  posts = 'posts',
}

@Injectable()
export class StorageService {
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
            console.log(`OK, I put object!`);
            const base = process.env.CLOUDFRONT_URL;
            console.log(`URL: ${base}`);
            console.log(`key: ${key}`);
            resolve(`${base}${key}`);
          }
        },
      );
    });
  }
}
