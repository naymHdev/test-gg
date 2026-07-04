export type TErrorSource = {
  path: string | number | null;
  message: string;
}[];

export type TErrorSources = TErrorSource[];

export type TGenericErrorResponse = {
  statusCode: number;
  message: string;
  errorSources: TErrorSource;
};
