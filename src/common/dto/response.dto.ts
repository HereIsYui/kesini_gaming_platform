/**
 * 统一响应数据传输对象
 */
export class ResponseDto<T> {
  code: number;
  message: string;
  data: T | null;

  constructor(code: number, message: string, data: T | null) {
    this.code = code;
    this.message = message;
    this.data = data;
  }

  /**
   * 成功响应
   * @param data 响应数据
   * @param message 提示信息
   * @returns ResponseDto
   */
  static success<T>(data: T, message: string = '操作成功'): ResponseDto<T> {
    return new ResponseDto(200, message, data);
  }

  /**
   * 失败响应
   * @param message 错误信息
   * @returns ResponseDto
   */
  static error(message: string = '操作失败'): ResponseDto<null> {
    return new ResponseDto(500, message, null);
  }

  /**
   * 自定义响应
   * @param code 状态码
   * @param message 提示信息
   * @param data 响应数据
   * @returns ResponseDto
   */
  static custom<T>(code: number, message: string, data: T | null): ResponseDto<T> {
    return new ResponseDto(code, message, data);
  }
}
