export type IResponse<T = unknown> = {
  code: string;
  data?: T;
  message?: string;
}