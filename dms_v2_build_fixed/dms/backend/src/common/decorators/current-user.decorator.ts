import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthContext } from '../../auth/auth.service';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthContext;
  },
);
