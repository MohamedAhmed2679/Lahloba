import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
@Module({
  imports: [JwtModule.registerAsync({ inject: [ConfigService], useFactory: (c: ConfigService) => ({ secret: c.get('JWT_SECRET'), signOptions: { expiresIn: c.get('JWT_EXPIRES_IN', '15m') } }) })],
  controllers: [AuthController], providers: [AuthService], exports: [AuthService, JwtModule],
})
export class AuthModule {}
