import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('Auth') @Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP' })
  requestOtp(@Body() body: { phone?: string; email?: string }) { return this.auth.requestOtp(body); }

  @Post('otp/verify') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP → JWT' })
  verifyOtp(@Body() body: { phone?: string; email?: string; code: string }) { return this.auth.verifyOtp(body); }

  @Post('refresh') @HttpCode(HttpStatus.OK)
  refresh(@Body() body: { refresh_token: string }) { return this.auth.refresh(body.refresh_token); }

  @Post('logout') @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() body: { refresh_token: string }) { return this.auth.logout(body.refresh_token); }
}
