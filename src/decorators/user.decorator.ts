import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';

type UserProperty = keyof User;
export const PrismaUser = createParamDecorator<UserProperty>(
  (data, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = <User>request.user;

    return data ? user[data] : user;
  },
);
