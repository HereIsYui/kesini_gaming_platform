import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
export class RechargeConfig {
  @PrimaryGeneratedColumn()
  id: number;

  // 是否开启玩家自助充值
  @Column({ default: false })
  enabled: boolean;

  // 鱼排金手指密钥，仅后台配置，不向玩家端返回
  @Column({ length: 255, default: "" })
  gold_finger_key: string;

  // 鱼排开放 API Key，用于充值前查询用户鱼排积分
  @Column({ length: 255, default: "" })
  fishpi_api_key: string;

  // 单次最小充值星穹币
  @Column({ default: 1 })
  min_amount: number;

  // 单次最大充值星穹币
  @Column({ default: 9999 })
  max_amount: number;

  // 兑换比例：1 鱼排积分可兑换多少星穹币
  @Column({ type: "decimal", precision: 10, scale: 4, default: 1 })
  recharge_ratio: number;

  // 提交给鱼排接口的备注模板，支持 {amount} 占位
  @Column({ length: 255, default: "抽卡平台充值，兑换星穹币 {amount}" })
  memo_template: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
