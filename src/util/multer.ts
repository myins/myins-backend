import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import * as path from 'path';

const photoSizeLimit = 1024 * 1024 * 15;
const videoSizeLimit = 1024 * 1024 * 100;

export const photoOptions: MulterOptions = {
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname);
    const isImage = ext === '.webp' || ext === '.jpg' || ext === '.jpeg';
    if (!isImage) {
      return callback(
        new Error('Only webp jpg or jpeg images are allowed'),
        false,
      );
    }
    callback(null, true);
  },
  limits: {
    fileSize: photoSizeLimit, // 15 mb
  },
};

export const photoInterceptor = FileInterceptor('file', photoOptions);

export const photoOrVideoOptions: MulterOptions = {
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isImage = ext === '.webp' || ext === '.jpg' || ext === '.jpeg';
    const isVideo = videoExtensions.includes(ext);
    if (!isImage && !isVideo) {
      return callback(
        new Error('The file is not in a supported format'),
        false,
      );
    }

    if (isImage && photoSizeLimit < file.size) {
      return callback(new Error('The file is too large!'), false);
    }
    if (isVideo && videoSizeLimit < file.size) {
      return callback(new Error('The file is too large!'), false);
    }

    callback(null, true);
  },
  limits: {
    fileSize: videoSizeLimit, // 100 MB - will check in fileFilter the size for photo (15 MB)
  },
};

export const isVideo = (originalName: string) => {
  const ext = path.extname(originalName);
  return videoExtensions.includes(ext);
};

export const videoExtensions = ['.mp4'];

export const photoOrVideoInterceptor = FileFieldsInterceptor(
  [
    { name: 'file', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ],
  photoOrVideoOptions,
);
