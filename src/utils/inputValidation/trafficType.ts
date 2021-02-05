import { isString } from '../lang';
import { logFactory } from '../../logger/sdkLogger';
const log = logFactory('');

const CAPITAL_LETTERS_REGEX = /[A-Z]/;

export function validateTrafficType(maybeTT: any, method: string): string | false {
  if (maybeTT == undefined) { // eslint-disable-line eqeqeq
    log.error(`${method}: you passed a null or undefined traffic_type_name, traffic_type_name must be a non-empty string.`);
  } else if (!isString(maybeTT)) {
    log.error(`${method}: you passed an invalid traffic_type_name, traffic_type_name must be a non-empty string.`);
  } else {
    if (maybeTT.length === 0) {
      log.error(`${method}: you passed an empty traffic_type_name, traffic_type_name must be a non-empty string.`);
    } else {
      if (CAPITAL_LETTERS_REGEX.test(maybeTT)) {
        log.warn(`${method}: traffic_type_name should be all lowercase - converting string to lowercase.`);
        maybeTT = maybeTT.toLowerCase();
      }

      return maybeTT;
    }
  }

  return false;
}
