export const callbackFn = (
  callback: ((arg: any) => void) | undefined,
  data: any,
): void => {
  if (typeof callback === "function") {
    callback(data);
  }
};
