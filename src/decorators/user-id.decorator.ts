import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserID = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const userID = <string>request.user.userId;
    return userID;
  },
);
