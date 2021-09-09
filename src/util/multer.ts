import { FileInterceptor } from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import * as path from 'path';

export const photoOptions: MulterOptions = {
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname);
    if (ext !== '.webp') {
      return callback(new Error('Only webp images are allowed'), false);
    }
    callback(null, true);
  },
  limits: {
    fileSize: 1024 * 1024 * 10, // 10 mb
  },
};

export const photoInterceptor = FileInterceptor('file', photoOptions);

export const photoOrVideoOptions: MulterOptions = {
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isImage = ext === '.webp' || ext === '.jpg' || ext === '.jpeg' || ext === '.heic'
    const isVideo = videoExtensions.includes(ext)
    if (!isImage && !isVideo) {
      return callback(new Error('The file is not in a supported format'), false);
    }
    const sizeLimit = isImage ? (1024 * 1024 * 10) : (1024 * 1024 * 10)

    if (sizeLimit < file.size) {
      return callback(new Error('The file is too large!'), false);
    }

    callback(null, true);
  },
  limits: {
    fileSize: 1024 * 1024 * 50, // largest of the 2
  },
};

export const isVideo = (originalName: string) => {
  const ext = path.extname(originalName)
  return videoExtensions.includes(ext)
}

export const videoExtensions = ['.mp4']

export const photoOrVideoInterceptor = FileInterceptor('file', photoOrVideoOptions);