/**
 * 统一响应数据传输对象
 */
export class ResponseDto<T> {
  code: number;
  msg: string;
  data: T | null;

  constructor(code: number, msg: string, data: T | null) {
    this.code = code;
    this.msg = msg;
    this.data = data;
  }

  /**
   * 成功响应
   * @param data 响应数据
   * @param msg 提示信息
   * @returns ResponseDto
   */
  static success<T>(data: T, msg: string = "操作成功"): ResponseDto<T> {
    return new ResponseDto(0, msg, data);
  }

  /**
   * 失败响应
   * @param msg 错误信息
   * @returns ResponseDto
   */
  static error(msg: string = "操作失败"): ResponseDto<null> {
    return new ResponseDto(-1, msg, null);
  }

  /**
   * 自定义响应
   * @param code 状态码
   * @param msg 提示信息
   * @param data 响应数据
   * @returns ResponseDto
   */
  static custom<T>(code: number, msg: string, data: T | null): ResponseDto<T> {
    return new ResponseDto(code, msg, data);
  }
}
