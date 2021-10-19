import { forwardRef, Module } from '@nestjs/common';
import { CommentModule } from 'src/comment/comment.module';
import { PostModule } from 'src/post/post.module';
import { UserModule } from 'src/user/user.module';
import { InteractionController } from './interaction.controller';
import { InteractionService } from './interaction.service';

@Module({
  imports: [
    forwardRef(() => CommentModule),
    forwardRef(() => UserModule),
    forwardRef(() => PostModule),
  ],
  controllers: [InteractionController],
  providers: [InteractionService],
  exports: [InteractionService],
})
export class InteractionModule {}
