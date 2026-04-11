import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('/v1/auth/otp/request (POST)', () => {
    return request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .send({ phone: '+201000000001' })
      .expect(200)
      .expect((res) => {
        expect(res.body.message).toBe('OTP sent');
      });
  });

  it('/v1/auth/otp/verify (POST) - bypass code', () => {
    return request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ phone: '+201000000001', code: '000000' })
      .expect(200)
      .expect((res) => {
        expect(res.body.access_token).toBeDefined();
        expect(res.body.user.role).toBe('CUSTOMER');
      });
  });
});
