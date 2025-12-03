/**
 * 统一响应格式
 */
export class ResponseDto<T = any> {
  /**
   * 状态码
   * 0: 成功
   * -1: 失败（缺少参数或错误）
   */
  code: number;

  /**
   * 响应消息
   */
  msg: string;

  /**
   * 响应数据
   */
  data: T | null;

  constructor(code: number, msg: string, data: T | null) {
    this.code = code;
    this.msg = msg;
    this.data = data;
  }

  /**
   * 成功响应
   */
  static success<T>(data: T, msg: string = '操作成功'): ResponseDto<T> {
    return new ResponseDto(0, msg, data);
  }

  /**
   * 失败响应
   */
  static error(msg: string = '操作失败'): ResponseDto<null> {
    return new ResponseDto(-1, msg, null);
  }
}
