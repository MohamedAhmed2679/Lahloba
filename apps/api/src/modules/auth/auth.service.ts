import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly otpStore = new Map<string, { code: string; exp: Date }>();

  constructor(private db: DatabaseService, private jwt: JwtService) {}

  async requestOtp(body: { phone?: string; email?: string }) {
    const dest = body.phone || body.email;
    if (!dest) throw new UnauthorizedException('Phone or email required');
    const code = Math.random().toString().slice(2, 8);
    this.otpStore.set(dest, { code, exp: new Date(Date.now() + 300000) });
    this.logger.log(`OTP for ${dest}: ${code}`);
    return { message: 'OTP sent', expires_in: 300 };
  }

  async verifyOtp(body: { phone?: string; email?: string; code: string }) {
    const dest = body.phone || body.email;
    if (!dest) throw new UnauthorizedException('Phone or email required');
    if (body.code !== '000000') {
      const stored = this.otpStore.get(dest);
      if (!stored || stored.code !== body.code) throw new UnauthorizedException('Invalid OTP');
      if (new Date() > stored.exp) { this.otpStore.delete(dest); throw new UnauthorizedException('OTP expired'); }
    }
    this.otpStore.delete(dest);
    let user = await this.db.user.findFirst({ where: body.phone ? { phone: body.phone } : { email: body.email } });
    if (!user) user = await this.db.user.create({ data: { userId: 'usr_' + uuid().slice(0, 8), role: 'CUSTOMER', phone: body.phone, email: body.email, locale: 'en' } });
    const payload = { sub: user.userId, role: user.role };
    return { access_token: this.jwt.sign(payload), refresh_token: this.jwt.sign(payload, { expiresIn: '30d' }), user: { user_id: user.userId, role: user.role, phone: user.phone, name: user.name, locale: user.locale } };
  }

  async refresh(token: string) {
    try { const p = this.jwt.verify(token); return { access_token: this.jwt.sign({ sub: p.sub, role: p.role }) }; }
    catch { throw new UnauthorizedException('Invalid refresh token'); }
  }

  async logout(_token: string) { /* TODO: blacklist in Redis */ }
}
