import type { Metaplex } from '@/Metaplex';
import {
  OperationConstructor,
  Operation,
  KeyOfOperation,
  InputOfOperation,
  OutputOfOperation,
  OperationHandler,
} from '@/types';
import { Task, TaskOptions } from '@/utils';
import { OperationHandlerMissingError } from '@/errors';

/**
 * @group Modules
 */
export class OperationClient {
  /**
   * Maps the name of an operation with its operation handler.
   * Whilst the types on the Map are relatively loose, we ensure
   * operations match with their handlers when registering them.
   */
protected operationHandlers: Map<
    string,
    OperationHandler<any, any, any, any>
  > = new Map();
constructor(protected readonly metaplex: Metaplex) {}

  
  

  register<
    T extends Operation<K, I, O>,
    K extends string = KeyOfOperation<T>,
    I = InputOfOperation<T>,
    O = OutputOfOperation<T>
  >(
    operationConstructor: OperationConstructor<T, K, I, O>,
    operationHandler: OperationHandler<T, K, I, O>
  ) {
    this.operationHandlers.set(operationConstructor.key, operationHandler);

    return this;
  }

  get<
    T extends Operation<K, I, O>,
    K extends string = KeyOfOperation<T>,
    I = InputOfOperation<T>,
    O = OutputOfOperation<T>
  >(operation: T): OperationHandler<T, K, I, O> {
    const operationHandler = this.operationHandlers.get(operation.key) as
      | OperationHandler<T, K, I, O>
      | undefined;

    if (!operationHandler) {
      throw new OperationHandlerMissingError(operation.key);
    }

    return operationHandler;
  }

  getTask<
    T extends Operation<K, I, O>,
    K extends string = KeyOfOperation<T>,
    I = InputOfOperation<T>,
    O = OutputOfOperation<T>
  >(operation: T): Task<O> {
    const operationHandler = this.get<T, K, I, O>(operation);

    return new Task((scope) => {
      return operationHandler.handle(operation, this.metaplex, scope);
    });
  }

  execute<
    T extends Operation<K, I, O>,
    K extends string = KeyOfOperation<T>,
    I = InputOfOperation<T>,
    O = OutputOfOperation<T>
  >(operation: T, options: TaskOptions = {}): Promise<O> {
    return this.getTask<T, K, I, O>(operation).run(options);
  }
}
