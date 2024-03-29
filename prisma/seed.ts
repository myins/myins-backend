import { Logger } from '@nestjs/common';
import {
  Prisma,
  PrismaClient,
  UserRole,
  DocumentType,
  NotificationSource,
  Notification,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { StreamChat } from 'stream-chat';

const prisma = new PrismaClient();
const streamChat = StreamChat.getInstance(
  process.env.GET_STREAM_API_KEY || '',
  process.env.GET_STREAM_API_SECRET,
);
const logger = new Logger('Seed');

async function main() {
  logger.log('Creating versions of TC and PP');
  await prisma.currentVersions.createMany({
    data: [
      {
        type: DocumentType.TERMS_AND_CONDITIONS,
      },
      {
        type: DocumentType.PRIVACY_POLICY,
      },
    ],
  });
  const currentVersions = await prisma.currentVersions.findMany();
  logger.log('Successfully created current versions of TC and PP');

  logger.log('Creating first user');
  const firstUserPassword = await bcrypt.hash('first', 10);
  const firstUserRefreshToken = crypto.randomBytes(64).toString('hex');
  const firstUserData: Prisma.UserCreateInput = {
    phoneNumber: '+40712345678',
    firstName: 'First',
    lastName: 'User',
    password: firstUserPassword,
    refreshToken: firstUserRefreshToken,
    lastAcceptedTermsAndConditionsVersion: currentVersions.find(
      (version) => version.type === DocumentType.TERMS_AND_CONDITIONS,
    )?.updatedAt,
    lastAcceptedPrivacyPolicyVersion: currentVersions.find(
      (version) => version.type === DocumentType.PRIVACY_POLICY,
    )?.updatedAt,
  };
  const firstUser = await prisma.user.create({ data: firstUserData });
  logger.log(
    `User ${firstUser.id} with phone number ${firstUser.phoneNumber} successfully created`,
  );

  try {
    logger.log('Creating first user stream');
    await streamChat.upsertUser({
      id: firstUser.id,
      name: `${firstUser.firstName} ${firstUser.lastName}`,
      phoneNumber: firstUser.phoneNumber,
      image: firstUser.profilePicture,
    });
    logger.log(`User stream ${firstUser.id} successfully created`);
  } catch (e) {
    const stringErr: string = <string>e;
    logger.error(
      `Error creating/updating stream chat user! Chat will not work! + ${stringErr}`,
    );
  }

  logger.log('Creating second user');
  const secondUserPassword = await bcrypt.hash('second', 10);
  const secondUserRefreshToken = crypto.randomBytes(64).toString('hex');
  const secondUserData: Prisma.UserCreateInput = {
    phoneNumber: '+40711111111',
    firstName: 'Second',
    lastName: 'User',
    password: secondUserPassword,
    refreshToken: secondUserRefreshToken,
  };
  const secondUser = await prisma.user.create({ data: secondUserData });
  logger.log(
    `User ${secondUser.id} with phone number ${secondUser.phoneNumber} successfully created`,
  );

  try {
    logger.log('Creating second user stream');
    await streamChat.upsertUser({
      id: secondUser.id,
      name: `${secondUser.firstName} ${secondUser.lastName}`,
      phoneNumber: secondUser.phoneNumber,
      image: secondUser.profilePicture,
    });
    logger.log(`User stream ${secondUser.id} successfully created`);
  } catch (e) {
    const stringErr: string = <string>e;
    logger.error(
      `Error creating/updating stream chat user! Chat will not work! + ${stringErr}`,
    );
  }

  logger.log('Creating third user');
  const thirdUserPassword = await bcrypt.hash('third', 10);
  const thirdUserRefreshToken = crypto.randomBytes(64).toString('hex');
  const thirdUserData: Prisma.UserCreateInput = {
    phoneNumber: '+40722222222',
    firstName: 'Third',
    lastName: 'User',
    password: thirdUserPassword,
    refreshToken: thirdUserRefreshToken,
  };
  const thirdUser = await prisma.user.create({ data: thirdUserData });
  logger.log(
    `User ${thirdUser.id} with phone number ${thirdUser.phoneNumber} successfully created`,
  );

  try {
    logger.log('Creating third user stream');
    await streamChat.upsertUser({
      id: thirdUser.id,
      name: `${thirdUser.firstName} ${thirdUser.lastName}`,
      phoneNumber: thirdUser.phoneNumber,
      image: thirdUser.profilePicture,
    });
    logger.log(`User stream ${thirdUser.id} successfully created`);
  } catch (e) {
    const stringErr: string = <string>e;
    logger.error(
      `Error creating/updating stream chat user! Chat will not work! + ${stringErr}`,
    );
  }

  logger.log(`Creating first INS`);
  const firstINS = await prisma.iNS.create({
    data: {
      name: 'First INS',
      shareCode: '111111',
      members: {
        create: {
          userId: firstUser.id,
          role: UserRole.ADMIN,
        },
      },
    },
  });
  logger.log(
    `INS ${firstINS.id} with admin user ${firstUser.id} successfully created`,
  );

  let firstChannel = null;
  try {
    logger.log('Creating first channel');
    firstChannel = streamChat.channel('messaging', firstINS.id, {
      name: firstINS.name,
      members: [firstUser.id],
      created_by_id: firstUser.id,
      image: firstINS.cover,
      insChannel: true,
    });
    await firstChannel.create();
    logger.log(
      `Channel ${firstINS.id} with owner ${firstUser.id} successfully created`,
    );
  } catch (e) {
    const stringErr: string = <string>e;
    logger.error(`Error creating stream channel! + ${stringErr}`);
  }

  logger.log(`Creating second INS`);
  const secondINS = await prisma.iNS.create({
    data: {
      name: 'Second INS',
      shareCode: '222222',
      members: {
        create: {
          userId: secondUser.id,
          role: UserRole.ADMIN,
        },
      },
    },
  });
  logger.log(
    `INS ${secondINS.id} with admin user ${secondUser.id} successfully created`,
  );

  let secondChannel = null;
  try {
    logger.log('Creating second channel');
    secondChannel = streamChat.channel('messaging', secondINS.id, {
      name: secondINS.name,
      members: [secondUser.id],
      created_by_id: secondUser.id,
      image: secondINS.cover,
      insChannel: true,
    });
    await secondChannel.create();
    logger.log(
      `Channel ${secondINS.id} with owner ${secondUser.id} successfully created`,
    );
  } catch (e) {
    const stringErr: string = <string>e;
    logger.error(`Error creating stream channel! + ${stringErr}`);
  }

  logger.log('Adding users to first INS');
  const dataAddFirstINS = [
    {
      userId: secondUser.id,
      role: UserRole.MEMBER,
    },
    {
      userId: thirdUser.id,
      role: UserRole.MEMBER,
    },
  ];
  await prisma.iNS.update({
    where: {
      id: firstINS.id,
    },
    data: {
      members: {
        createMany: {
          data: dataAddFirstINS,
        },
      },
    },
  });
  const targetIDsAddFirstINSNotification = (
    await prisma.userInsConnection.findMany({
      where: {
        insId: firstINS.id,
      },
    })
  ).map((connection) => {
    return { id: connection.userId };
  });
  const addFirstINSSecondUserNotification = await prisma.notification.create({
    data: {
      source: NotificationSource.JOINED_INS,
      targets: {
        connect: targetIDsAddFirstINSNotification,
      },
      author: {
        connect: {
          id: secondUser.id,
        },
      },
      ins: {
        connect: {
          id: firstINS.id,
        },
      },
    },
  });
  const addFirstINSThirdUserNotification = await prisma.notification.create({
    data: {
      source: NotificationSource.JOINED_INS,
      targets: {
        connect: targetIDsAddFirstINSNotification,
      },
      author: {
        connect: {
          id: thirdUser.id,
        },
      },
      ins: {
        connect: {
          id: firstINS.id,
        },
      },
    },
  });
  logger.log(
    `Users ${dataAddFirstINS.map(
      (connection) => connection.userId,
    )} successfully added to ins ${firstINS.id}. Created notifications ${
      addFirstINSSecondUserNotification.id
    } and ${addFirstINSThirdUserNotification.id}`,
  );

  if (firstChannel) {
    try {
      logger.log('Adding stream users to first channel');
      await firstChannel.addMembers(
        dataAddFirstINS.map((connection) => connection.userId),
      );
      logger.log(
        `Stream users ${dataAddFirstINS.map(
          (connection) => connection.userId,
        )} successfully added to channel ${firstINS.id}`,
      );
    } catch (e) {
      const stringErr: string = <string>e;
      logger.error(`Error adding members to stream channel! + ${stringErr}`);
    }
  }

  logger.log('Adding users to second INS');
  const dataAddSecondINS = [
    {
      userId: thirdUser.id,
      role: UserRole.MEMBER,
    },
  ];
  await prisma.iNS.update({
    where: {
      id: secondINS.id,
    },
    data: {
      members: {
        createMany: {
          data: dataAddSecondINS,
        },
      },
    },
  });
  const targetIDsAddSecondNotification = (
    await prisma.userInsConnection.findMany({
      where: {
        insId: secondINS.id,
      },
    })
  ).map((connection) => {
    return { id: connection.userId };
  });
  const addSecondINSThirdUserNotification = await prisma.notification.create({
    data: {
      source: NotificationSource.JOINED_INS,
      targets: {
        connect: targetIDsAddSecondNotification,
      },
      author: {
        connect: {
          id: thirdUser.id,
        },
      },
      ins: {
        connect: {
          id: secondINS.id,
        },
      },
    },
  });
  logger.log(
    `Users ${dataAddSecondINS.map(
      (connection) => connection.userId,
    )} successfully added to ins ${secondINS.id}. Created notification ${
      addSecondINSThirdUserNotification.id
    }`,
  );

  if (secondChannel) {
    try {
      logger.log('Adding stream users to second channel');
      await secondChannel.addMembers(
        dataAddSecondINS.map((connection) => connection.userId),
      );
      logger.log(
        `Stream users ${dataAddSecondINS.map(
          (connection) => connection.userId,
        )} successfully added to channel ${secondINS.id}`,
      );
    } catch (e) {
      const stringErr: string = <string>e;
      logger.error(`Error adding members to stream channel! + ${stringErr}`);
    }
  }

  logger.log('Creating first post');
  const firstPost = await prisma.post.create({
    data: {
      content: 'First post',
      author: {
        connect: {
          id: firstUser.id,
        },
      },
      pending: false,
      totalMediaContent: 5,
      ins: {
        connect: { id: firstINS.id },
      },
    },
    include: {
      ins: true,
    },
  });
  const targetIDsFirstPostNotification = (
    await prisma.userInsConnection.findMany({
      where: {
        insId: firstINS.id,
        userId: {
          not: firstUser.id,
        },
      },
    })
  ).map((connection) => {
    return { id: connection.userId };
  });
  const firstPostNotification = await prisma.notification.create({
    data: {
      source: NotificationSource.POST,
      targets: {
        connect: targetIDsFirstPostNotification,
      },
      author: {
        connect: {
          id: firstUser.id,
        },
      },
      post: {
        connect: {
          id: firstPost.id,
        },
      },
    },
  });
  logger.log(
    `Post ${firstPost.id} succesfully created in inses ${[
      firstINS.id,
    ]} by user ${firstUser.id}. Created notification ${
      firstPostNotification.id
    }`,
  );

  try {
    logger.log('Sending a message in channels with first post');
    const firstPostChannels = await streamChat.queryChannels({
      id: { $in: [firstINS.id] },
    });
    await Promise.all(
      firstPostChannels.map(async (channel) => {
        await channel.sendMessage({
          user_id: firstUser.id,
          text: '',
          data: {
            custom_type: 'new_post',
            post_id: firstPost.id,
          },
        });
      }),
    );
    logger.log(
      `Successfully sent a message in channels ${[firstINS.id]} with post ${
        firstPost.id
      } created by user ${firstUser.id}`,
    );
  } catch (e) {
    const stringErr: string = <string>e;
    logger.error(`Error sending message to stream channel! + ${stringErr}`);
  }

  logger.log('Creating second post');
  const secondPost = await prisma.post.create({
    data: {
      content: 'Second post',
      author: {
        connect: {
          id: secondUser.id,
        },
      },
      pending: false,
      totalMediaContent: 5,
      ins: {
        connect: {
          id: secondINS.id,
        },
      },
    },
    include: {
      ins: true,
    },
  });
  const targetIDsSecondPostNotification = (
    await prisma.userInsConnection.findMany({
      where: {
        insId: {
          in: [firstINS.id, secondINS.id],
        },
        userId: {
          not: secondUser.id,
        },
      },
    })
  ).map((connection) => {
    return { id: connection.userId };
  });
  const secondPostNotification = await prisma.notification.create({
    data: {
      source: NotificationSource.POST,
      targets: {
        connect: targetIDsSecondPostNotification,
      },
      author: {
        connect: {
          id: secondUser.id,
        },
      },
      post: {
        connect: {
          id: secondPost.id,
        },
      },
    },
  });
  logger.log(
    `Post ${secondPost.id} succesfully created in inses ${[
      firstINS.id,
      secondINS.id,
    ]} by user ${secondUser.id}. Created notification ${
      secondPostNotification.id
    }`,
  );

  try {
    logger.log('Sending a message in channels with second post');
    const secondPostChannels = await streamChat.queryChannels({
      id: { $in: [firstINS.id, secondINS.id] },
    });
    await Promise.all(
      secondPostChannels.map(async (channel) => {
        await channel.sendMessage({
          user_id: secondUser.id,
          text: '',
          data: {
            custom_type: 'new_post',
            post_id: secondPost.id,
          },
        });
      }),
    );
    logger.log(
      `Successfully sent a message in channels ${[secondINS.id]} with post ${
        (firstINS.id, secondPost.id)
      } created by user ${secondUser.id}`,
    );
  } catch (e) {
    const stringErr: string = <string>e;
    logger.error(`Error sending message to stream channel! + ${stringErr}`);
  }

  logger.log('Creating first comment');
  const firstComment = await prisma.comment.create({
    data: {
      content: 'First comment',
      author: {
        connect: {
          id: firstUser.id,
        },
      },
      post: {
        connect: {
          id: secondPost.id,
        },
      },
    },
  });
  let firstCommentNotification: Notification;
  if (secondPost.authorId) {
    firstCommentNotification = await prisma.notification.create({
      data: {
        source: NotificationSource.COMMENT,
        targets: {
          connect: {
            id: secondPost.authorId,
          },
        },
        author: {
          connect: {
            id: firstUser.id,
          },
        },
        comment: {
          connect: {
            id: firstComment.id,
          },
        },
        post: {
          connect: {
            id: secondPost.id,
          },
        },
      },
    });
    logger.log(
      `Comment ${firstComment.id} successfully created for post ${secondPost.id} by user ${firstUser.id}. Created notification ${firstCommentNotification.id}`,
    );
  }

  logger.log('Creating second comment');
  const secondComment = await prisma.comment.create({
    data: {
      content: 'Second comment',
      author: {
        connect: {
          id: secondUser.id,
        },
      },
      post: {
        connect: {
          id: firstPost.id,
        },
      },
    },
    include: {
      post: {
        include: {
          ins: true,
        },
      },
    },
  });
  let secondCommentNotification: Notification;
  if (firstPost.authorId) {
    secondCommentNotification = await prisma.notification.create({
      data: {
        source: NotificationSource.COMMENT,
        targets: {
          connect: {
            id: firstPost.authorId,
          },
        },
        author: {
          connect: {
            id: secondUser.id,
          },
        },
        comment: {
          connect: {
            id: secondComment.id,
          },
        },
        post: {
          connect: {
            id: firstPost.id,
          },
        },
      },
    });
    logger.log(
      `Comment ${secondComment.id} successfully created for post ${firstPost.id} by user ${secondUser.id}. Created notification ${secondCommentNotification.id}`,
    );
  }

  logger.log('Creating third comment');
  const thirdComment = await prisma.comment.create({
    data: {
      content: 'Third comment',
      author: {
        connect: {
          id: thirdUser.id,
        },
      },
      post: {
        connect: {
          id: secondPost.id,
        },
      },
    },
    include: {
      post: {
        include: {
          ins: true,
        },
      },
    },
  });
  let thirdCommentNotification: Notification;
  if (secondPost.authorId) {
    thirdCommentNotification = await prisma.notification.create({
      data: {
        source: NotificationSource.COMMENT,
        targets: {
          connect: {
            id: secondPost.authorId,
          },
        },
        author: {
          connect: {
            id: thirdUser.id,
          },
        },
        comment: {
          connect: {
            id: thirdComment.id,
          },
        },
        post: {
          connect: {
            id: secondPost.id,
          },
        },
      },
    });
    logger.log(
      `Comment ${thirdComment.id} successfully created for post ${secondPost.id} by user ${thirdUser.id}. Created notification ${thirdCommentNotification.id}`,
    );
  }

  logger.log('Creating first like post');
  await prisma.post.update({
    where: { id: secondPost.id },
    data: {
      likes: {
        create: {
          userId: firstUser.id,
        },
      },
    },
  });
  await prisma.userInsConnection.updateMany({
    where: {
      insId: secondPost.ins.id,
      userId: firstUser.id,
    },
    data: {
      interactions: {
        increment: 1,
      },
    },
  });
  let firstLikePostNotification: Notification;
  if (secondPost.authorId) {
    firstLikePostNotification = await prisma.notification.create({
      data: {
        source: NotificationSource.LIKE_POST,
        targets: {
          connect: {
            id: secondPost.authorId,
          },
        },
        author: {
          connect: {
            id: firstUser.id,
          },
        },
        post: {
          connect: {
            id: secondPost.id,
          },
        },
      },
    });
    logger.log(
      `User ${firstUser.id} liked post ${secondPost.id}. Created notification ${firstLikePostNotification.id}`,
    );
  }

  logger.log('Creating second like post');
  await prisma.post.update({
    where: { id: firstPost.id },
    data: {
      likes: {
        create: {
          userId: thirdUser.id,
        },
      },
    },
  });
  await prisma.userInsConnection.updateMany({
    where: {
      insId: firstPost.ins.id,
      userId: thirdUser.id,
    },
    data: {
      interactions: {
        increment: 1,
      },
    },
  });
  let secondLikePostNotification: Notification;
  if (firstPost.authorId) {
    secondLikePostNotification = await prisma.notification.create({
      data: {
        source: NotificationSource.LIKE_POST,
        targets: {
          connect: {
            id: firstPost.authorId,
          },
        },
        author: {
          connect: {
            id: thirdUser.id,
          },
        },
        post: {
          connect: {
            id: firstPost.id,
          },
        },
      },
    });
    logger.log(
      `User ${thirdUser.id} liked post ${firstPost.id}. Created notification ${secondLikePostNotification.id}`,
    );
  }

  logger.log('First like comment');
  await prisma.comment.update({
    where: { id: secondComment.id },
    data: {
      likes: {
        create: {
          userId: secondUser.id,
        },
      },
    },
  });
  await prisma.userInsConnection.updateMany({
    where: {
      insId: secondComment.post.ins.id,
      userId: secondUser.id,
    },
    data: {
      interactions: {
        increment: 1,
      },
    },
  });
  const firstLikeCommentNotification = await prisma.notification.create({
    data: {
      source: NotificationSource.LIKE_COMMENT,
      targets: {
        connect: {
          id: secondComment.authorId,
        },
      },
      author: {
        connect: {
          id: secondUser.id,
        },
      },
      post: {
        connect: {
          id: secondComment.postId,
        },
      },
      comment: {
        connect: {
          id: secondComment.id,
        },
      },
    },
  });
  logger.log(
    `User ${secondUser.id} liked comment ${secondComment.id}. Created notification ${firstLikeCommentNotification.id}`,
  );

  logger.log('Second like comment');
  await prisma.comment.update({
    where: { id: thirdComment.id },
    data: {
      likes: {
        create: {
          userId: firstUser.id,
        },
      },
    },
  });
  await prisma.userInsConnection.updateMany({
    where: {
      insId: thirdComment.post.ins.id,
      userId: firstUser.id,
    },
    data: {
      interactions: {
        increment: 1,
      },
    },
  });
  const secondLikeCommentNotification = await prisma.notification.create({
    data: {
      source: NotificationSource.LIKE_COMMENT,
      targets: {
        connect: {
          id: thirdComment.authorId,
        },
      },
      author: {
        connect: {
          id: firstUser.id,
        },
      },
      post: {
        connect: {
          id: thirdComment.postId,
        },
      },
      comment: {
        connect: {
          id: thirdComment.id,
        },
      },
    },
  });
  logger.log(
    `User ${firstUser.id} liked comment ${thirdComment.id}. Created notification ${secondLikeCommentNotification.id}`,
  );

  logger.log('Third like comment');
  await prisma.comment.update({
    where: { id: thirdComment.id },
    data: {
      likes: {
        create: {
          userId: thirdUser.id,
        },
      },
    },
  });
  await prisma.userInsConnection.updateMany({
    where: {
      insId: thirdComment.post.ins.id,
      userId: thirdUser.id,
    },
    data: {
      interactions: {
        increment: 1,
      },
    },
  });
  const thirdLikeCommentNotification = await prisma.notification.create({
    data: {
      source: NotificationSource.LIKE_COMMENT,
      targets: {
        connect: {
          id: thirdComment.authorId,
        },
      },
      author: {
        connect: {
          id: thirdUser.id,
        },
      },
      post: {
        connect: {
          id: thirdComment.postId,
        },
      },
      comment: {
        connect: {
          id: thirdComment.id,
        },
      },
    },
  });
  logger.log(
    `User ${thirdUser.id} liked comment ${thirdComment.id}. Created notification ${thirdLikeCommentNotification.id}`,
  );
}

main()
  .catch((e) => {
    logger.error(`Error processing seed ${e}`);
    process.exit(1);
  })
  .finally(async () => {
    logger.log('Seed successfully finished');
    await prisma.$disconnect();
  });
