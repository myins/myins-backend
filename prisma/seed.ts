import { Logger } from '@nestjs/common';
import { Prisma, PrismaClient, UserRole, DocumentType } from '@prisma/client';
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
  logger.log('Create versions of TC and PP');
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

  logger.log('Create first user');
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

  logger.log('Create first user stream');
  await streamChat.upsertUser({
    id: firstUser.id,
    name: `${firstUser.firstName} ${firstUser.lastName}`,
    phoneNumber: firstUser.phoneNumber,
    image: firstUser.profilePicture,
  });
  logger.log(`User stream ${firstUser.id} successfully created`);

  logger.log('Create second user');
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

  logger.log('Create second user stream');
  await streamChat.upsertUser({
    id: secondUser.id,
    name: `${secondUser.firstName} ${secondUser.lastName}`,
    phoneNumber: secondUser.phoneNumber,
    image: secondUser.profilePicture,
  });
  logger.log(`User stream ${secondUser.id} successfully created`);

  logger.log('Create third user');
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

  logger.log('Create third user stream');
  await streamChat.upsertUser({
    id: thirdUser.id,
    name: `${thirdUser.firstName} ${thirdUser.lastName}`,
    phoneNumber: thirdUser.phoneNumber,
    image: thirdUser.profilePicture,
  });
  logger.log(`User stream ${thirdUser.id} successfully created`);

  logger.log(`Create first INS`);
  const firstINS = await prisma.iNS.create({
    data: {
      name: 'First INS',
      shareCode: '#1111',
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

  logger.log('Create first channel');
  const firstChannel = streamChat.channel('messaging', firstINS.id, {
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

  logger.log(`Create second INS`);
  const secondINS = await prisma.iNS.create({
    data: {
      name: 'Second INS',
      shareCode: '#2222',
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

  logger.log('Create second channel');
  const secondChannel = streamChat.channel('messaging', secondINS.id, {
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
  logger.log(
    `Users ${dataAddFirstINS.map(
      (connection) => connection.userId,
    )} successfully added to ins ${firstINS.id}`,
  );

  logger.log('Adding stream users to first channel');
  await firstChannel.addMembers(
    dataAddFirstINS.map((connection) => connection.userId),
  );
  logger.log(
    `Stream users ${dataAddFirstINS.map(
      (connection) => connection.userId,
    )} successfully added to channel ${firstINS.id}`,
  );

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
  logger.log(
    `Users ${dataAddSecondINS.map(
      (connection) => connection.userId,
    )} successfully added to ins ${secondINS.id}`,
  );

  logger.log('Adding stream users to second channel');
  await secondChannel.addMembers(
    dataAddSecondINS.map((connection) => connection.userId),
  );
  logger.log(
    `Stream users ${dataAddSecondINS.map(
      (connection) => connection.userId,
    )} successfully added to channel ${secondINS.id}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    logger.log('Seed successfully finished');
    await prisma.$disconnect();
  });
