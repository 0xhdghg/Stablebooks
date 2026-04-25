import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { CurrentAuth } from "./current-auth";

type AuthenticatedRequest = {
  auth?: CurrentAuth;
};

export const AuthUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentAuth => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.auth ?? { userId: "", organizationId: null };
  }
);
