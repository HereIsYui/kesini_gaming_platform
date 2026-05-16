import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { JwtUtilsService } from '../utils/jwt';
import { ConfigurationService } from '../config/configuration.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigurationService) => ({
        secret: configService.jwtSecret,
        signOptions: { expiresIn: configService.jwtExpiresIn as any },
      }),
      inject: [ConfigurationService],
    }),
  ],
  providers: [JwtStrategy, JwtUtilsService],
  exports: [JwtUtilsService],
})
export class AuthModule {}