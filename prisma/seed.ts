import { Logger } from '@nestjs/common';
import { Prisma, PrismaClient, UserRole, DocumentType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
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
  const firstUserData: Prisma.UserCreateInput = {
    phoneNumber: '+40712345678',
    firstName: 'First',
    lastName: 'User',
    password: firstUserPassword,
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

  logger.log('Create second user');
  const secondUserPassword = await bcrypt.hash('second', 10);
  const secondUserData: Prisma.UserCreateInput = {
    phoneNumber: '+40711111111',
    firstName: 'Second',
    lastName: 'User',
    password: secondUserPassword,
  };
  const secondUser = await prisma.user.create({ data: secondUserData });
  logger.log(
    `User ${secondUser.id} with phone number ${secondUser.phoneNumber} successfully created`,
  );

  logger.log('Create third user');
  const thirdUserPassword = await bcrypt.hash('third', 10);
  const thirdUserData: Prisma.UserCreateInput = {
    phoneNumber: '+40722222222',
    firstName: 'Third',
    lastName: 'User',
    password: thirdUserPassword,
  };
  const thirdUser = await prisma.user.create({ data: thirdUserData });
  logger.log(
    `User ${thirdUser.id} with phone number ${thirdUser.phoneNumber} successfully created`,
  );

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

  logger.log('Adding users to first INS');
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
