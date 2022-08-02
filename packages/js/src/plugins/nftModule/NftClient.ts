import { PublicKey } from '@solana/web3.js';
import type { Metaplex } from '@/Metaplex';
import { Task } from '@/utils';
import { token } from '@/types';
import { Metadata } from './Metadata';
import { assertNftWithToken, Nft, NftWithToken } from './Nft';
import { assertSft, Sft, SftWithToken } from './Sft';
import {
  CreateNftInput,
  createNftOperation,
  CreateNftOutput,
} from './createNft';
import {
  CreateSftInput,
  createSftOperation,
  CreateSftOutput,
} from './createSft';
import {
  FindNftByMetadataInput,
  findNftByMetadataOperation,
  FindNftByMetadataOutput,
} from './findNftByMetadata';
import {
  FindNftByMintInput,
  findNftByMintOperation,
  FindNftByMintOutput,
} from './findNftByMint';
import {
  FindNftByTokenInput,
  findNftByTokenOperation,
  FindNftByTokenOutput,
} from './findNftByToken';
import {
  FindNftsByMintListInput,
  findNftsByMintListOperation,
} from './findNftsByMintList';
import {
  FindNftsByOwnerInput,
  findNftsByOwnerOperation,
} from './findNftsByOwner';
import {
  FindNftsByUpdateAuthorityInput,
  findNftsByUpdateAuthorityOperation,
} from './findNftsByUpdateAuthority';
import {
  FindNftsByCreatorInput,
  findNftsByCreatorOperation,
} from './findNftsByCreator';
import {
  LoadMetadataInput,
  loadMetadataOperation,
  LoadMetadataOutput,
} from './loadMetadata';
import {
  printNewEditionOperation,
  PrintNewEditionOutput,
  PrintNewEditionSharedInput,
  PrintNewEditionViaInput,
} from './printNewEdition';
import {
  UploadMetadataInput,
  uploadMetadataOperation,
  UploadMetadataOutput,
} from './uploadMetadata';
import {
  UpdateNftInput,
  updateNftOperation,
  UpdateNftOutput,
} from './updateNft';
import { NftBuildersClient } from './NftBuildersClient';
import { UseNftInput, useNftOperation, UseNftOutput } from './useNft';
import { SendTokensInput, SendTokensOutput } from '../tokenModule';
import { HasMintAddress, toMintAddress } from './helpers';

export class NftClient {
  constructor(protected readonly metaplex: Metaplex) {}

  builders() {
    return new NftBuildersClient(this.metaplex);
  }

  create(input: CreateNftInput): Task<CreateNftOutput & { nft: NftWithToken }> {
    return new Task(async (scope) => {
      const operation = createNftOperation(input);
      const output = await this.metaplex.operations().execute(operation, scope);
      scope.throwIfCanceled();
      const nft = await this.findByMint(output.mintAddress, {
        tokenAddress: output.tokenAddress,
      }).run(scope);
      assertNftWithToken(nft);
      return { ...output, nft };
    });
  }

  createSft(
    input: CreateSftInput
  ): Task<CreateSftOutput & { sft: Sft | SftWithToken }> {
    return new Task(async (scope) => {
      const operation = createSftOperation(input);
      const output = await this.metaplex.operations().execute(operation, scope);
      scope.throwIfCanceled();
      const sft = await this.findByMint(output.mintAddress, {
        tokenAddress: output.tokenAddress ?? undefined,
      }).run(scope);
      assertSft(sft);
      return { ...output, sft };
    });
  }

  findByMetadata(
    metadata: PublicKey,
    options?: Omit<FindNftByMetadataInput, 'metadata'>
  ): Task<FindNftByMetadataOutput> {
    return this.metaplex
      .operations()
      .getTask(findNftByMetadataOperation({ metadata, ...options }));
  }

  findByMint(
    mint: PublicKey,
    options?: Omit<FindNftByMintInput, 'mint'>
  ): Task<FindNftByMintOutput> {
    return this.metaplex
      .operations()
      .getTask(findNftByMintOperation({ mint, ...options }));
  }

  findByToken(
    token: PublicKey,
    options?: Omit<FindNftByTokenInput, 'token'>
  ): Task<FindNftByTokenOutput> {
    return this.metaplex
      .operations()
      .getTask(findNftByTokenOperation({ token, ...options }));
  }

  findAllByCreator(
    creator: PublicKey,
    options?: Omit<FindNftsByCreatorInput, 'creator'>
  ) {
    return this.metaplex
      .operations()
      .getTask(findNftsByCreatorOperation({ creator, ...options }));
  }

  findAllByMintList(
    mints: PublicKey[],
    options?: Omit<FindNftsByMintListInput, 'mints'>
  ) {
    return this.metaplex
      .operations()
      .getTask(findNftsByMintListOperation({ mints, ...options }));
  }

  findAllByOwner(
    owner: PublicKey,
    options?: Omit<FindNftsByOwnerInput, 'owner'>
  ) {
    return this.metaplex
      .operations()
      .getTask(findNftsByOwnerOperation({ owner, ...options }));
  }

  findAllByUpdateAuthority(
    updateAuthority: PublicKey,
    options?: Omit<FindNftsByUpdateAuthorityInput, 'updateAuthority'>
  ) {
    return this.metaplex
      .operations()
      .getTask(
        findNftsByUpdateAuthorityOperation({ updateAuthority, ...options })
      );
  }

  load(
    metadata: Metadata,
    options?: Omit<LoadMetadataInput, 'metadata'>
  ): Task<LoadMetadataOutput> {
    return this.metaplex
      .operations()
      .getTask(loadMetadataOperation({ metadata, ...options }));
  }

  printNewEdition(
    originalNft: HasMintAddress,
    input: Omit<PrintNewEditionSharedInput, 'originalMint'> &
      PrintNewEditionViaInput = {}
  ): Task<PrintNewEditionOutput & { nft: NftWithToken }> {
    return new Task(async (scope) => {
      const originalMint = toMintAddress(originalNft);
      const operation = printNewEditionOperation({ originalMint, ...input });
      const output = await this.metaplex.operations().execute(operation, scope);
      scope.throwIfCanceled();
      const nft = await this.findByMint(output.mintSigner.publicKey, {
        tokenAddress: output.tokenAddress,
      }).run(scope);
      assertNftWithToken(nft);
      return { ...output, nft };
    });
  }

  refresh<
    T extends Nft | Sft | NftWithToken | SftWithToken | Metadata | PublicKey
  >(
    nftOrSft: T,
    options?: Omit<FindNftByMintInput, 'mint' | 'tokenAddres' | 'tokenOwner'>
  ): Task<T extends Metadata | PublicKey ? Nft | Sft : T> {
    return this.findByMint(toMintAddress(nftOrSft), {
      tokenAddress: 'token' in nftOrSft ? nftOrSft.token.address : undefined,
      ...options,
    }) as Task<T extends Metadata | PublicKey ? Nft | Sft : T>;
  }

  send(
    nftOrSft: HasMintAddress,
    newOwner: PublicKey,
    options?: Omit<SendTokensInput, 'toOwner' | 'toToken'>
  ): Task<SendTokensOutput> {
    return this.metaplex.tokens().send({
      mint: toMintAddress(nftOrSft),
      toOwner: newOwner,
      amount: token(1),
      ...options,
    });
  }

  uploadMetadata(input: UploadMetadataInput): Task<UploadMetadataOutput> {
    return this.metaplex.operations().getTask(uploadMetadataOperation(input));
  }

  update(
    nftOrSft: Nft | Sft | NftWithToken | SftWithToken,
    input: Omit<UpdateNftInput, 'nftOrSft'>
  ): Task<UpdateNftOutput> {
    return this.metaplex
      .operations()
      .getTask(updateNftOperation({ ...input, nftOrSft }));
  }

  use(
    nft: HasMintAddress,
    input: Omit<UseNftInput, 'mintAddress'> = {}
  ): Task<UseNftOutput> {
    return this.metaplex
      .operations()
      .getTask(useNftOperation({ ...input, mintAddress: toMintAddress(nft) }));
  }
}
