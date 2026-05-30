import { randomBytes } from "crypto";
import { Repository } from "typeorm";
import { User } from "src/entity/user.entity";

type UserPublicIdRepository = Pick<Repository<User>, "findOne" | "save">;

const PUBLIC_ID_BYTES = 8;
const PUBLIC_ID_RETRIES = 8;

export function createUserPublicId() {
  return randomBytes(PUBLIC_ID_BYTES).toString("hex");
}

export function getUserPublicId(
  user?: Pick<User, "public_id" | "uid"> | null,
) {
  return String(user?.public_id || user?.uid || "").trim();
}

export async function assignUserPublicId(
  repository: UserPublicIdRepository,
  user: User,
) {
  const existingPublicId = String(user.public_id || "").trim();
  if (existingPublicId) {
    return existingPublicId;
  }

  for (let index = 0; index < PUBLIC_ID_RETRIES; index += 1) {
    const candidate = createUserPublicId();
    const existing = await repository.findOne({
      where: { public_id: candidate },
    });
    if (!existing || existing.id === user.id) {
      user.public_id = candidate;
      return candidate;
    }
  }

  throw new Error("public id unavailable");
}

export async function ensureUserPublicId(
  repository: UserPublicIdRepository,
  user: User,
) {
  const existingPublicId = String(user.public_id || "").trim();
  if (existingPublicId) {
    return existingPublicId;
  }
  const publicId = await assignUserPublicId(repository, user);
  await repository.save(user);
  return publicId;
}

export async function ensureUsersPublicIds(
  repository: UserPublicIdRepository,
  users: User[],
) {
  if (typeof repository.save !== "function") {
    return;
  }
  await Promise.all(
    users
      .filter((user) => !String(user.public_id || "").trim())
      .map((user) => ensureUserPublicId(repository, user)),
  );
}
