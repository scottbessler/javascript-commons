import { ERROR_20 } from '../../logger/codesConstants';
import { ILogger } from '../../logger/types';
import { isFiniteNumber } from '../lang';
// import { logFactory } from '../../logger/sdkLogger';
// const log = logFactory('');

export function validateEventValue(log: ILogger, maybeValue: any, method: string): number | false {
  if (isFiniteNumber(maybeValue) || maybeValue == undefined) // eslint-disable-line eqeqeq
    return maybeValue;

  log.error(ERROR_20, [method]);
  return false;
}
