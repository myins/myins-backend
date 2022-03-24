import { Injectable, Logger } from '@nestjs/common';
import {
    Prisma,
    NotificationSource,
    User,
    Post,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { NotificationPushService, PushExtraNotification } from './notification.push.service';
import { UserConnectionService } from 'src/user/user.connection.service';
import { InsService } from 'src/ins/ins.service';
import { PostService } from 'src/post/post.service';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';

export interface NotificationCache {
    authorLikePost: User | null | undefined
    postLikePost: Post | null
}

@Injectable()
export class NotificationCacheService {

    constructor(
        private readonly userService: UserService,
        private readonly postService: PostService,
    ) { }


    async getDBCache(notif: Prisma.NotificationCreateInput | PushExtraNotification) {
        switch (notif.source) {
            case NotificationSource.LIKE_POST:
                const authorLikePost = await this.userService.shallowUser({
                    id: notif.author.connect?.id,
                });
                const postLikePost = await this.postService.post(
                    {
                        id: notif.post?.connect?.id,
                    },
                    {
                        author: {
                            select: ShallowUserSelect,
                        },
                    },
                );
                return <NotificationCache>{
                    authorLikePost: authorLikePost,
                    postLikePost: postLikePost
                }
        }
        return <NotificationCache>{}
    }
}
