import { forwardRef, Module } from '@nestjs/common';
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
    forwardRef(() => PostModule),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
