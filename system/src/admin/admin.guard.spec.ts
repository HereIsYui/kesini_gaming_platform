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
  it("允许环境变量白名单管理员访问", async () => {
    const guard = new AdminGuard(
      {
        findOne: jest.fn().mockResolvedValue({ uid: "admin", is_admin: false }),
      } as any,
      { adminUids: ["admin"] } as any,
    );

    await expect(guard.canActivate(createContext("admin"))).resolves.toBe(true);
  });

  it("允许数据库管理员访问", async () => {
    const guard = new AdminGuard(
      {
        findOne: jest.fn().mockResolvedValue({ uid: "admin", is_admin: true }),
      } as any,
      { adminUids: [] } as any,
    );

    await expect(guard.canActivate(createContext("admin"))).resolves.toBe(true);
  });

  it("拒绝非管理员访问", async () => {
    const guard = new AdminGuard(
      {
        findOne: jest.fn().mockResolvedValue({ uid: "user", is_admin: false }),
      } as any,
      { adminUids: [] } as any,
    );

    await expect(
      guard.canActivate(createContext("user")),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("拒绝未登录请求", async () => {
    const guard = new AdminGuard(
      { findOne: jest.fn() } as any,
      { adminUids: [] } as any,
    );

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
