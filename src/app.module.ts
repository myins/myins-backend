import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { UserModule } from './user/user.module';
import { PostModule } from './post/post.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StorageModule } from './storage/storage.module';
import { CommentModule } from './comment/comment.module';
import { NotificationModule } from './notification/notification.module';
import { FfmpegModule } from './ffmpeg/ffmpeg.module';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ShareModule } from './share/share.module';
import { FirebaseAdminModule } from '@aginix/nestjs-firebase-admin';
import { SmsModule } from './sms/sms.module';
import { InsModule } from './ins/ins.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { InviteModule } from './invite/invite.module';
import { CurrentVersionsModule } from './current-versions/current-versions.module';
import * as admin from 'firebase-admin';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    PostModule,
    CommentModule,
    AuthModule,
    SmsModule,
    StorageModule,
    NotificationModule,
    FfmpegModule,
    ThrottlerModule.forRoot({
      ttl: 30,
      limit: 30,
    }),
    ShareModule,
    FirebaseAdminModule.forRootAsync({
      useFactory: async () => {
        const adminConfig: admin.ServiceAccount = {
          projectId: 'myins-1975b',
          clientEmail:
            'firebase-adminsdk-1dyiz@myins-1975b.iam.gserviceaccount.com',
          privateKey:
            '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDC3nbVCugB2vWM\nBq+AwDMtARBvWb2MA1hapJKRJxY2H/WA6kUE9Gl9Pg9vdV7fmqVmDtfOU11SFHD7\nkZ0O1vpEppGfCony7jv+kIMskYyyxN4Vm+lwNaPPaGRfAm6Yyi3WO4W+vf65ciux\nyC2rcD2lA2Uq9CCvh4mlF1QJ73Gf4PAlY8jGKx0tsEk3cUCgcu8vSOuHUmX43bk0\nDg6DkBOKUdVlbUovzhd+54YB9LWxBnt17sDvDlCYtoC+FneXuoS7oUarjKoXE2T0\nReMgemDoaazra5nP0uE0V8SzZYq36uvBUAVlvzwtsyesGCYMWCud8xfCNkn+wZk8\nCe02RbVjAgMBAAECggEABO/Wj4kqMuSANLRKp/a2lTJMtKAlEYdYKrEMAYoS9vtn\noITO4NRBrpREQdegYrEr9Yz0t1vHUSKxcL4nU3lAzT0caAIVV/E51eDatztXbC6u\nowTYgijpuyxy4TFSP06yoJXQypyiTRfGYZz9AzXhv0Ikbap9ACrCjaCCAYpuairL\nuIVfTGVqeXbQwGYkvGHOVywhT8ow4GTxD9C5OQE+D5AoLamr4iV5Zd7vqPMU1c+h\nDyMfBsEpGdvo6X66laxuBS+jPuND52TOTiknmaOo+9VG4I2ApqozmKHNgLWldlCd\nJh2CTKEHUrJfMIv4cDiAiIQ244l/1IBea20JU7FV0QKBgQDlUFDyd2CsyUcPfsuS\ngolj+EIhfxYu91odnTnC7EceCGhq1cmk1o8NcIhJ3Gt+cHX3U/DBRpqUDPMYnHKr\nE6Wq8QZEROOjgWpe02ks8EGa4QkZv4SjzZ34rmi/gth24UuYNPh6KVNYllOhre3t\nfONb7KeX8ePNMpvr3Qwc0qYduQKBgQDZi/mhQIwDgQt/oyD06PFmDzmy3X/nDCEq\ntg8wPThZJDxoe09TJOwOAwN2wUCTeNJ58O7qJH3VDvlN6KV7jsT6b258YkOnqJ5U\nJs3yWkY+7/PDqd1r4jXLDEVX9btbseoWHwaISQOdh8vHiM4FIraITTc9CcYR/3Xd\nttvG7DuZ+wKBgBJogScFuEgGnGK9DgCD5B2XV0+zEQfSKXTJI1LnfsoFaMRyxw4p\nfzBYAUjUnfh3dLDXFzOcxFnwNC+cl4PuPtVbJeKjGRcOE4jrNb06yDlzqTRc8Hvp\nzK2i6pu9GD1q1pOwZOYBnUQ2RR5shPYUmXfOpqGG9H+LeYLUqt1Bd75ZAoGBAIcU\nD/NdNdLzLKWbL9qCTWm2qHf0aveWo312wCWOzc8j3dJuRon00hG9M0hopGUtT1ti\nC6cc83j4rDoA68e1lX9+81aOWT3gSDcuRRBnl1h6+5wRfCgBtK8YNnJwZV6BMT19\nFDxJQdJtwE1sF6g+rqIhd9wRlogUXCZH5V01z6hDAoGBAJreQv463y0PumbBZ2+8\npwKm2oLpS+twjXbI6GLbEhiiyLfGT/6WXP2pFbE0gCV084aHdnxbxbYRao7B5vYJ\nNHi9CO/VRmoc8TOOyNiBNuWVUEhONakx/0emc5yERCmk99bdx2c+CamqC3cApAZN\nv3DWforo+QQEYfLI3BPi3nY+\n-----END PRIVATE KEY-----\n',
        };
        const toRet = admin.credential.cert(adminConfig);
        return {
          credential: toRet,
        };
      },
    }),
    SmsModule,
    InsModule,
    OnboardingModule,
    InviteModule,
    CurrentVersionsModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  controllers: [AppController],
})
export class AppModule {}
