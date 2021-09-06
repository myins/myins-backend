import { forwardRef, Module } from '@nestjs/common';
import { CurrentVersionsModule } from 'src/current-versions/current-versions.module';
import { PostModule } from 'src/post/post.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SjwtModule } from 'src/sjwt/sjwt.module';
import { SmsModule } from 'src/sms/sms.module';
import { StorageModule } from 'src/storage/storage.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [
    PrismaModule,
    SjwtModule,
    SmsModule,
    StorageModule,
    CurrentVersionsModule,
    forwardRef(() => PostModule),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
