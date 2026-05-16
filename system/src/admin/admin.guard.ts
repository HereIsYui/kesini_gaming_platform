import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigurationService } from "src/config/configuration.service";
import { User } from "src/entity/user.entity";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly configService: ConfigurationService,
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

    const isAdmin =
      user.is_admin === true || this.configService.adminUids.includes(uid);
    if (!isAdmin) {
      throw new ForbiddenException("缺少后台管理权限");
    }

    request.adminUser = user;
    return true;
  }
}
