import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { CurrentAuth } from "./current-auth";

type AuthenticatedRequest = {
  headers: {
    authorization?: string;
  };
  auth?: CurrentAuth;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing authentication token.");
    }

    const token = authorization.slice("Bearer ".length).trim();
    const authContext = await this.authService.getContextFromToken(token);

    request.auth = {
      userId: authContext.user.id,
      organizationId: authContext.organization?.id ?? null
    };

    return true;
  }
}
