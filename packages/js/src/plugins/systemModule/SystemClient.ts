import type { Metaplex } from '@/Metaplex';
import { CreateAccountInput, createAccountOperation } from './createAccount';
import { SystemBuildersClient } from './SystemBuildersClient';
import { TransferSolInput, transferSolOperation } from './transferSol';

/**
 * This is a client for the System module.
 *
 * It enables us to interact with the System program in order to
 * create uninitialized accounts and transfer SOL.
 *
 * You may access this client via the `system()` method of your `Metaplex` instance.
 *
 * ```ts
 * const systemClient = metaplex.system();
 * ```
 *
 * @example
 * You can create a new uninitialized account with a given space in bytes
 * using the code below.
 *
 * ```ts
 * const { newAccount } = await metaplex.system().createAccount({ space: 42 });
 * ```
 *
 * @group Modules
 */
export class SystemClient {
  constructor(protected readonly metaplex: Metaplex) {}

  /**
   * You may use the `builders()` client to access the
   * underlying Transaction Builders of this module.
   */
  builders() {
    return new SystemBuildersClient(this.metaplex);
  }

  /** {@inheritDoc createAccountOperation} */
  createAccount(input: CreateAccountInput) {
    return this.metaplex.operations().getTask(createAccountOperation(input));
  }

  /** {@inheritDoc transferSolOperation} */
  transferSol(input: TransferSolInput) {
    return this.metaplex.operations().getTask(transferSolOperation(input));
  }
}
