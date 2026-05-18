import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { AdminGuard } from "./admin.guard";

function createContext(uid?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: uid ? { uid } : undefined }),
    }),
  } as any;
}

describe("AdminGuard", () => {
  it("允许数据库管理员访问", async () => {
    const guard = new AdminGuard({
      findOne: jest.fn().mockResolvedValue({ uid: "admin", is_admin: true }),
    } as any);

    await expect(guard.canActivate(createContext("admin"))).resolves.toBe(true);
  });

  it("拒绝白名单但数据库字段不是管理员的用户", async () => {
    const guard = new AdminGuard({
      findOne: jest.fn().mockResolvedValue({ uid: "admin", is_admin: false }),
    } as any);

    await expect(
      guard.canActivate(createContext("admin")),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("拒绝非管理员访问", async () => {
    const guard = new AdminGuard({
      findOne: jest.fn().mockResolvedValue({ uid: "user", is_admin: false }),
    } as any);

    await expect(
      guard.canActivate(createContext("user")),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("拒绝未登录请求", async () => {
    const guard = new AdminGuard({ findOne: jest.fn() } as any);

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
