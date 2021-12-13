import { Prisma } from '.prisma/client';

const insWithStoriesIDData = {
  stories: true,
};
export const InsWithStoriesIDInclude: Prisma.INSInclude = insWithStoriesIDData;

const insWithStoriesID = Prisma.validator<Prisma.INSArgs>()({
  include: insWithStoriesIDData,
});
export type InsWithStoriesID = Prisma.INSGetPayload<typeof insWithStoriesID>;
