import dayjs from "dayjs";

export const getExpireTime = (time: number, vipDays: number) => {
  const exporeDay = dayjs(time).add(vipDays, "day");
  return exporeDay.valueOf();
};
