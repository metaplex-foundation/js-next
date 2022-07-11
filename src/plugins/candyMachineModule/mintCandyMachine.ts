import {
  ConfirmOptions,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SYSVAR_SLOT_HASHES_PUBKEY,
} from '@solana/web3.js';
import { createMintNftInstruction } from '@metaplex-foundation/mpl-candy-machine';
import {
  Operation,
  OperationHandler,
  Signer,
  token,
  useOperation,
} from '@/types';
import { Metaplex } from '@/Metaplex';
import { TransactionBuilder } from '@/utils';
import { CandyMachine } from './CandyMachine';
import { SendAndConfirmTransactionResponse } from '../rpcModule';
import {
  findMasterEditionV2Pda,
  findMetadataPda,
  TokenMetadataProgram,
} from '../nftModule';
import { findCandyMachineCreatorPda } from './pdas';

// -----------------
// Operation
// -----------------

const Key = 'MintCandyMachineOperation' as const;
export const mintCandyMachineOperation =
  useOperation<MintCandyMachineOperation>(Key);
export type MintCandyMachineOperation = Operation<
  typeof Key,
  MintCandyMachineInput,
  MintCandyMachineOutput
>;

export type MintCandyMachineInput = {
  // Models and Accounts.
  candyMachine: CandyMachine;
  payer?: Signer; // Defaults to mx.identity().
  newMint?: Signer; // Defaults to Keypair.generate().
  newOwner?: PublicKey; // Defaults to mx.identity().
  newToken?: Signer; // Defaults to associated token.

  // Programs.
  tokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
  tokenMetadataProgram?: PublicKey;

  // Transaction Options.
  confirmOptions?: ConfirmOptions;
};

export type MintCandyMachineOutput = {
  response: SendAndConfirmTransactionResponse;
};

// -----------------
// Handler
// -----------------

export const mintCandyMachineOperationHandler: OperationHandler<MintCandyMachineOperation> =
  {
    async handle(
      operation: MintCandyMachineOperation,
      metaplex: Metaplex
    ): Promise<MintCandyMachineOutput> {
      const builder = await mintCandyMachineBuilder(metaplex, operation.input);
      return builder.sendAndConfirm(metaplex, operation.input.confirmOptions);
    },
  };

// -----------------
// Builder
// -----------------

export type MintCandyMachineBuilderParams = Omit<
  MintCandyMachineInput,
  'confirmOptions'
> & {
  createMintAccountInstructionKey?: string;
  initializeMintInstructionKey?: string;
  createAssociatedTokenAccountInstructionKey?: string;
  createTokenAccountInstructionKey?: string;
  initializeTokenInstructionKey?: string;
  mintTokensInstructionKey?: string;
  mintNftInstructionKey?: string;
};

export const mintCandyMachineBuilder = async (
  metaplex: Metaplex,
  params: MintCandyMachineBuilderParams
): Promise<TransactionBuilder> => {
  const {
    candyMachine,
    payer = metaplex.identity(),
    newMint = Keypair.generate(),
    newOwner = metaplex.identity().publicKey,
    newToken,
    tokenProgram,
    associatedTokenProgram,
  } = params;

  const newMetadata = findMetadataPda(newMint.publicKey);
  const newEdition = findMasterEditionV2Pda(newMint.publicKey);
  const candyMachineCreator = findCandyMachineCreatorPda(candyMachine.address);

  const tokenWithMintBuilder = await metaplex
    .tokens()
    .builders()
    .createTokenWithMint({
      decimals: 0,
      initialSupply: token(1),
      mint: newMint,
      mintAuthority: payer,
      freezeAuthority: payer.publicKey,
      owner: newOwner,
      token: newToken,
      payer,
      tokenProgram,
      associatedTokenProgram,
      createMintAccountInstructionKey: params.createMintAccountInstructionKey,
      initializeMintInstructionKey: params.initializeMintInstructionKey,
      createAssociatedTokenAccountInstructionKey:
        params.createAssociatedTokenAccountInstructionKey,
      createTokenAccountInstructionKey: params.createTokenAccountInstructionKey,
      initializeTokenInstructionKey: params.initializeTokenInstructionKey,
      mintTokensInstructionKey: params.mintTokensInstructionKey,
    });

  return TransactionBuilder.make()
    .setFeePayer(payer)
    .add(tokenWithMintBuilder)
    .add({
      instruction: createMintNftInstruction(
        {
          candyMachine: candyMachine.address,
          candyMachineCreator: candyMachineCreator,
          payer: payer.publicKey,
          wallet: candyMachine.walletAddress,
          metadata: newMetadata,
          mint: newMint.publicKey,
          mintAuthority: payer.publicKey,
          updateAuthority: payer.publicKey,
          masterEdition: newEdition,
          tokenMetadataProgram:
            params.tokenMetadataProgram ?? TokenMetadataProgram.publicKey,
          clock: SYSVAR_CLOCK_PUBKEY,
          recentBlockhashes: SYSVAR_SLOT_HASHES_PUBKEY,
          instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY,
        },
        { creatorBump: candyMachineCreator.bump }
      ),
      signers: [payer, newMint],
      key: params.mintNftInstructionKey ?? 'mintNft',
    });
};
