import { Controller } from '@nestjs/common';

@Controller('share')
export class ShareController {
  // @Post('post')
  // @UseGuards(JwtAuthGuard)
  // @ApiTags('posts-spotlite')
  // async sharePost(
  //     @Body() postData: SharePostAPI,
  //     @UserID() userID: string,
  // ) {
  //     const { postID, targetIDs } = postData;
  //     const allPromises = targetIDs.map(each => {
  //       return this.notificationService.createNotification({
  //         source: 'SHARED_POST',
  //         target: {
  //             connect: {
  //                 id: each,
  //             },
  //         },
  //         author: {
  //             connect: {
  //                 id: userID,
  //             },
  //         },
  //         post: {
  //             connect: {
  //                 id: postID,
  //             },
  //         },
  //     })
  //     })
  //     await Promise.all(allPromises)
  //     return {
  //         status: "ok"
  //     }
  // }
}
