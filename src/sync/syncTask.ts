import { SYNC_TASK_EXECUTE, SYNC_TASK_START, SYNC_TASK_STOP } from '../logger/constants';
import { ILogger } from '../logger/types';
import { ISyncTask } from './types';

/**
 * Creates a syncTask that handles the periodic execution of a given task ("start" and "stop" methods).
 * The task can be also executed by calling the "execute" method. Multiple execute calls are chained to run secuentially and avoid race conditions.
 * For example, submitters executed on SDK destroy or full queue, while periodic execution is pending.
 *
 * @param log  Logger instance.
 * @param task  Task to execute that returns a promise that NEVER REJECTS. Otherwise, periodic execution can result in Unhandled Promise Rejections.
 * @param period  Period in milliseconds to execute the task.
 * @param taskName  Optional task name for logging.
 * @returns A sync task that wraps the given task.
 */
export function syncTaskFactory<Input extends any[], Output = any>(log: ILogger, task: (...args: Input) => Promise<Output>, period: number, taskName = 'task'): ISyncTask<Input, Output> {

  // Task promise while it is pending. Undefined once the promise is resolved
  let pendingTask: Promise<Output> | undefined;
  // flag that indicates if the task periodic execution has been started/stopped.
  let running = false;
  // Auxiliar counter used to avoid race condition when calling `start` & `stop` intermittently
  let runningId = 0;
  // Params passed to `task` when called periodically
  let runningArgs: Input;
  // Id of the periodic call timeout
  let timeoutID: any;

  function execute(...args: Input): Promise<Output> {
    // If task is executing, chain new execution to avoid race conditions
    if (pendingTask) {
      return pendingTask.then(() => {
        return execute(...args);
      });
    }

    // Execute task
    log.debug(SYNC_TASK_EXECUTE, [taskName]);
    pendingTask = task(...args).then(result => {
      pendingTask = undefined;
      return result;
    });
    return pendingTask;
  }

  function periodicExecute(currentRunningId: number) {
    return execute(...runningArgs).then((result) => {
      // Call `setTimeout` if periodic execution was started and `currentRunningId === runningId`
      // to avoid a race condition when calling `start`, `stop` and `start` again
      if (running && currentRunningId === runningId) timeoutID = setTimeout(periodicExecute, period, currentRunningId);
      return result;
    });
  }

  return {
    execute,

    isExecuting() {
      return pendingTask !== undefined;
    },

    start(...args: Input) {
      if (!running) {
        running = true;
        runningId++;
        runningArgs = args;
        log.debug(SYNC_TASK_START, [taskName, period]);
        return periodicExecute(runningId);
      }
    },

    stop() {
      running = false;
      if (timeoutID) {
        log.debug(SYNC_TASK_STOP, [taskName]);
        clearTimeout(timeoutID);
        timeoutID = undefined;
      }
    },

    isRunning() {
      return running;
    }
  };
}
