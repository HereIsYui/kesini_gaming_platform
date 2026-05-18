import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "src/entity/user.entity";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const uid = request.user?.uid;

    if (!uid) {
      throw new UnauthorizedException("用户身份验证失败");
    }

    const user = await this.userRepository.findOne({ where: { uid } });
    if (!user) {
      throw new UnauthorizedException("用户不存在");
    }

    if (user.is_admin !== true) {
      throw new ForbiddenException("缺少后台管理权限");
    }

    request.adminUser = user;
    return true;
  }
}
