import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";

type AuthHeaderInput = {
  authorization?: string;
};

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("auth/signup")
  async signup(
    @Body() body: { email: string; password: string; name: string }
  ) {
    return {
      data: await this.authService.signup(body)
    };
  }

  @Post("auth/signin")
  async signin(@Body() body: { email: string; password: string }) {
    return {
      data: await this.authService.signin(body)
    };
  }

  @Post("auth/signout")
  async signout(@Headers() headers: AuthHeaderInput) {
    const token = this.extractToken(headers.authorization);
    return {
      data: await this.authService.signout(token)
    };
  }

  @Get("me")
  async me(@Headers() headers: AuthHeaderInput) {
    const token = this.extractToken(headers.authorization);
    return {
      data: await this.authService.getMe(token)
    };
  }

  private extractToken(authorization?: string) {
    if (!authorization?.startsWith("Bearer ")) {
      return null;
    }

    return authorization.slice("Bearer ".length).trim();
  }
}
