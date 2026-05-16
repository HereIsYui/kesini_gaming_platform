import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface TokenPayload {
  uid: string;
}

@Injectable()
export class JwtUtilsService {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * 生成JWT token
   * @param payload token载荷，包含用户uid
   * @param expiresIn 过期时间，默认7天
   * @returns JWT token字符串
   */
  generateToken(payload: TokenPayload, expiresIn: string = '7d'): string {
    return this.jwtService.sign(payload, { expiresIn: expiresIn as any });
  }

  /**
   * 验证并解析JWT token
   * @param token JWT token字符串
   * @returns 解析后的payload，包含用户uid
   */
  verifyToken(token: string): TokenPayload {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch (error) {
      throw new Error('无效的token: ' + error.message);
    }
  }

  /**
   * 从Bearer格式的Authorization header中提取token
   * @param authHeader Authorization header值，格式为 "Bearer {token}"
   * @returns JWT token字符串
   */
  extractTokenFromHeader(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Authorization header格式错误，应为"Bearer {token}"');
    }
    return authHeader.substring(7);
  }
}