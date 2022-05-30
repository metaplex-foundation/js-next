import { PublicKey, Transaction } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { DriverNotProvidedError } from '@/errors';
import { HasDriver, IdentitySigner, Signer } from '@/types';
import { IdentityDriver } from './IdentityDriver';

export class IdentityClient
  implements HasDriver<IdentityDriver>, IdentitySigner
{
  private _driver: IdentityDriver | null = null;

  driver(): IdentityDriver {
    if (!this._driver) {
      throw new DriverNotProvidedError('IdentityDriver');
    }

    return this._driver;
  }

  setDriver(newDriver: IdentityDriver): void {
    this._driver = newDriver;
  }

  get publicKey(): PublicKey {
    return this.driver().publicKey;
  }

  signMessage(message: Uint8Array): Promise<Uint8Array> {
    return this.driver().signMessage(message);
  }

  signTransaction(transaction: Transaction): Promise<Transaction> {
    return this.driver().signTransaction(transaction);
  }

  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]> {
    return this.driver().signAllTransactions(transactions);
  }

  public async verifyMessage(
    message: Uint8Array,
    signature: Uint8Array
  ): Promise<boolean> {
    return nacl.sign.detached.verify(
      message,
      signature,
      this.publicKey.toBytes()
    );
  }

  public equals(that: Signer | PublicKey): boolean {
    if ('publicKey' in that) {
      that = that.publicKey;
    }

    return this.publicKey.equals(that);
  }
}
