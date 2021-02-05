import { ISplitsCacheSync } from './types';
import { ISplit } from '../dtos/types';

/**
 * This class provides a skeletal implementation of the ISplitsCacheSync interface
 * to minimize the effort required to implement this interface.
 */
export default abstract class AbstractSplitsCacheSync implements ISplitsCacheSync {

  abstract addSplit(name: string, split: string): boolean;

  addSplits(entries: [string, string][]): boolean[] {
    const results: boolean[] = [];

    entries.forEach(keyValuePair => {
      results.push(this.addSplit(keyValuePair[0], keyValuePair[1]));
    });

    return results;
  }

  abstract removeSplit(name: string): number

  removeSplits(names: string[]): number {
    let len = names.length;
    let counter = 0;

    for (let i = 0; i < len; i++) {
      counter += this.removeSplit(names[i]);
    }

    return counter;
  }

  abstract getSplit(name: string): string | null

  getSplits(names: string[]): Record<string, string | null> {
    const splits: Record<string, string | null> = {};
    names.forEach(name => {
      splits[name] = this.getSplit(name);
    });
    return splits;
  }

  abstract setChangeNumber(changeNumber: number): boolean

  abstract getChangeNumber(): number

  getAll(): string[] {
    return this.getSplitNames().map(key => this.getSplit(key) as string);
  }

  abstract getSplitNames(): string[]

  abstract trafficTypeExists(trafficType: string): boolean

  abstract usesSegments(): boolean

  abstract clear(): void

  /**
   * Check if the splits information is already stored in cache. This data can be preloaded.
   * It is used as condition to emit SDK_SPLITS_CACHE_LOADED, and then SDK_READY_FROM_CACHE.
   */
  checkCache(): boolean {
    return this.getChangeNumber() > -1;
  }

  killLocally(name: string, defaultTreatment: string, changeNumber: number): boolean {
    const split = this.getSplit(name);

    if (split) {
      const parsedSplit: ISplit = JSON.parse(split);
      if (!parsedSplit.changeNumber || parsedSplit.changeNumber < changeNumber) {
        parsedSplit.killed = true;
        parsedSplit.defaultTreatment = defaultTreatment;
        parsedSplit.changeNumber = changeNumber;
        const newSplit = JSON.stringify(parsedSplit);

        return this.addSplit(name, newSplit);
      }
    }
    return false;
  }

}

/**
 * Given a parsed split, it returns a boolean flagging if its conditions use segments matchers (rules & whitelists).
 * This util is intended to simplify the implementation of `splitsCache::usesSegments` method
 */
export function usesSegments({ conditions = [] }: ISplit) {
  for (let i = 0; i < conditions.length; i++) {
    const matchers = conditions[i].matcherGroup.matchers;

    for (let j = 0; j < matchers.length; j++) {
      if (matchers[j].matcherType === 'IN_SEGMENT') return true;
    }
  }

  return false;
}
