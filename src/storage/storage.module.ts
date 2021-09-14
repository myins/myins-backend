// eslint-disable-next-line @typescript-eslint/no-var-requires
if (process.env.NODE_ENV !== 'production') require('dotenv').config(); // This fixes env variables on dev

import { Module } from '@nestjs/common';
import { S3Module } from 'nestjs-s3';
import { StorageService } from './storage.service';

@Module({
  imports: [
    S3Module.forRoot({
      config: {
        accessKeyId: process.env['S3_KEY_ID'],
        secretAccessKey: process.env['S3_SECRET_ACCESS_KEY'],
        region: process.env['S3_REGION'],
        s3ForcePathStyle: true,
        signatureVersion: 'v4',
      },
    }),
  ],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
