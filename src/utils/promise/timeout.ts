import { SplitTimeoutError } from '../lang/errors';

export default function timeout<T>(ms: number, promise: Promise<T>): Promise<T> {
  if (ms < 1) return promise;

  return new Promise((resolve, reject) => {
    const tid = setTimeout(() => {
      reject(new SplitTimeoutError(`Operation timed out because it exceeded the configured time limit of ${ms}ms.`));
    }, ms);

    promise.then((res) => {
      clearTimeout(tid);
      resolve(res);
    }, (err) => {
      clearTimeout(tid);
      reject(err);
    });
  });
}
