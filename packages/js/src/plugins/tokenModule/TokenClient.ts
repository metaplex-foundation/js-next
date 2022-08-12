import type { Metaplex } from '@/Metaplex';
import {
  ApproveTokenDelegateAuthorityInput,
  approveTokenDelegateAuthorityOperation,
} from './approveTokenDelegateAuthority';
import { CreateMintInput, createMintOperation } from './createMint';
import { CreateTokenInput, createTokenOperation } from './createToken';
import {
  CreateTokenWithMintInput,
  createTokenWithMintOperation,
} from './createTokenWithMint';
import {
  FindMintByAddressInput,
  findMintByAddressOperation,
} from './findMintByAddress';
import {
  FindTokenByAddressInput,
  findTokenByAddressOperation,
} from './findTokenByAddress';
import {
  FindTokenWithMintByAddressInput,
  findTokenWithMintByAddressOperation,
} from './findTokenWithMintByAddress';
import {
  FindTokenWithMintByMintInput,
  findTokenWithMintByMintOperation,
} from './findTokenWithMintByMint';
import { FreezeTokensInput, freezeTokensOperation } from './freezeTokens';
import { MintTokensInput, mintTokensOperation } from './mintTokens';
import {
  RevokeTokenDelegateAuthorityInput,
  revokeTokenDelegateAuthorityOperation,
} from './revokeTokenDelegateAuthority';
import { SendTokensInput, sendTokensOperation } from './sendTokens';
import { ThawTokensInput, thawTokensOperation } from './thawTokens';
import { TokenBuildersClient } from './TokenBuildersClient';

/**
 * This is a client for the Token module.
 *
 * It enables us to interact with the Token program in order to create,
 * send, freeze, thaw, and mint tokens.
 *
 * You may access this client via the `tokens()` method of your `Metaplex` instance.
 *
 * ```ts
 * const tokenClient = metaplex.tokens();
 * ```
 *
 * @example
 * You can create a new mint account with an associated token account like so.
 * The owner of this token account will, by default, be the current identity
 * of the metaplex instance.
 *
 * ```ts
 * const { token } = await metaplex.tokens().createTokenWithMint();
 * ```
 *
 * @group Modules
 */
export class TokenClient {
  constructor(protected readonly metaplex: Metaplex) {}

  builders() {
    return new TokenBuildersClient(this.metaplex);
  }

  // -----------------
  // Queries
  // -----------------

  findMintByAddress(input: FindMintByAddressInput) {
    return this.metaplex
      .operations()
      .getTask(findMintByAddressOperation(input));
  }

  findTokenByAddress(input: FindTokenByAddressInput) {
    return this.metaplex
      .operations()
      .getTask(findTokenByAddressOperation(input));
  }

  findTokenWithMintByAddress(input: FindTokenWithMintByAddressInput) {
    return this.metaplex
      .operations()
      .getTask(findTokenWithMintByAddressOperation(input));
  }

  findTokenWithMintByMint(input: FindTokenWithMintByMintInput) {
    return this.metaplex
      .operations()
      .getTask(findTokenWithMintByMintOperation(input));
  }

  // -----------------
  // Create
  // -----------------

  /**
   * Create a new Mint account from the provided input
   * and returns the newly created `Mint` model.
   */
  createMint(input?: CreateMintInput) {
    return this.metaplex.operations().getTask(createMintOperation(input ?? {}));
  }

  /**
   * Create a new Token account from the provided input
   * and returns the newly created `Token` model.
   */
  createToken(input: CreateTokenInput) {
    return this.metaplex.operations().getTask(createTokenOperation(input));
  }

  createTokenWithMint(input: CreateTokenWithMintInput = {}) {
    return this.metaplex
      .operations()
      .getTask(createTokenWithMintOperation(input));
  }

  // -----------------
  // Update
  // -----------------

  mint(input: MintTokensInput) {
    return this.metaplex.operations().getTask(mintTokensOperation(input));
  }

  send(input: SendTokensInput) {
    return this.metaplex.operations().getTask(sendTokensOperation(input));
  }

  freeze(input: FreezeTokensInput) {
    return this.metaplex.operations().getTask(freezeTokensOperation(input));
  }

  thaw(input: ThawTokensInput) {
    return this.metaplex.operations().getTask(thawTokensOperation(input));
  }

  // -----------------
  // Delegate
  // -----------------

  approveDelegateAuthority(input: ApproveTokenDelegateAuthorityInput) {
    return this.metaplex
      .operations()
      .getTask(approveTokenDelegateAuthorityOperation(input));
  }

  revokeDelegateAuthority(input: RevokeTokenDelegateAuthorityInput) {
    return this.metaplex
      .operations()
      .getTask(revokeTokenDelegateAuthorityOperation(input));
  }
}
