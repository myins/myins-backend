import { Injectable, Logger } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
// Do NOT follow the next warning, it will start returning undefined!!!
// @ts-ignore
import * as pathToFfmpeg from 'ffmpeg-static';
import * as stream from 'stream';
import * as tempy from 'tempy';
import * as fs from 'fs';

if (pathToFfmpeg) {
  ffmpeg.setFfmpegPath(pathToFfmpeg);
}

@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name)

  private async uploadFile(file: Express.Multer.File) {

    const getRandomInt = (max: number) => {
      return Math.floor(Math.random() * max);
    }

    const tempDir = tempy.directory();
    const ourTempFilename = `${file.filename}_${getRandomInt(100000)}.jpg`;
    const fullTempPath = `${tempDir}/${ourTempFilename}`
    fs.writeFileSync(fullTempPath, file.buffer)


    const ourFilename = `${file.filename}_${getRandomInt(100000)}.jpg`;

    const logger = this.logger

    return new Promise<Buffer>((resolve, reject) => {
      ffmpeg(fullTempPath)
        .format('mp4')
        .takeScreenshots({
          timestamps: [0],
          count: 1,
          filename: ourFilename,
          folder: tempDir,
        }).setDuration(0)
        .on('error', function (err, stdout, stderr) {
          logger.log(`An error occured: ${err.message}`)
          logger.log(err)
          logger.log(stderr)
          return reject(new Error(err));
        })
        .on('end', function (firstVar, secondVar, thirdVar) {
          function delay(ms: number) {
            return new Promise(resolve => setTimeout(resolve, ms));
          }
          delay(100).then(res => {
            try {
              const toRes = fs.readFileSync(`${tempDir}/${ourFilename}`)
              resolve(toRes)
            } catch {
              logger.log("Generation crashed, please retry!")
              return reject(new Error("Thumbnail generation crashed!"))
            }
          })
        })
        .output('/dev/null')
        .run();
    });
  }

  async generateThumbnail(file: Express.Multer.File) {
    //const myReadableStreamBuffer = Readable.from(file.buffer)
    this.logger.log(`Ok, video is uploaded, we gotta generate a thumbnail! ${file.filename}`)
    const inputForFFMPEG = new stream.PassThrough();
    inputForFFMPEG.push(file.buffer);

    const toRet = await this.uploadFile(file)
    return toRet
  }
}
