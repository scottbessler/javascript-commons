import { isString } from '../../utils/lang';
import { logFactory } from '../../logger/sdkLogger';
const log = logFactory('splitio-engine:matcher');

export default function containsStringMatcherContext(ruleAttr: string[]) /*: Function */ {
  return function containsStringMatcher(runtimeAttr: string): boolean {
    let contains = ruleAttr.some(e => isString(runtimeAttr) && runtimeAttr.indexOf(e) > -1);

    log.d(`[containsStringMatcher] ${runtimeAttr} contains ${ruleAttr}? ${contains}`);

    return contains;
  };
}
