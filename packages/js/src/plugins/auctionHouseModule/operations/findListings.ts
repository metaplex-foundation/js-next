import { PublicKey } from '@solana/web3.js';
import { toListingReceiptAccount } from '../accounts';
import { ListingReceiptGpaBuilder } from '../gpaBuilders';
import { AuctionHouse, LazyListing, Listing, toLazyListing } from '../models';
import {
  Operation,
  OperationHandler,
  OperationScope,
  useOperation,
} from '@/types';
import { Metaplex } from '@/Metaplex';

// -----------------
// Operation
// -----------------

const Key = 'FindListingsOperation' as const;

/**
 * Finds Listings by multiple criteria.
 * Metadata field is ignored whe Mint is provided.
 *
 * ```ts
 * // Find listings by seller and metadata.
 * const listings = await metaplex
 *   .auctionHouse()
 *   .findListings({ auctionHouse, seller, metadata });
 *
 * // Find listings by seller and mint.
 * const listings = await metaplex
 *   .auctionHouse()
 *   .findListings({ auctionHouse, seller, mint });
 * ```
 *
 * @group Operations
 * @category Constructors
 */
export const findListingsOperation = useOperation<FindListingsOperation>(Key);

/**
 * @group Operations
 * @category Types
 */
export type FindListingsOperation = Operation<
  typeof Key,
  FindListingsInput,
  FindListingsOutput
>;

/**
 * @group Operations
 * @category Inputs
 */
export type FindListingsInput = {
  /** A model of the Auction House related to these listings. */
  auctionHouse: AuctionHouse;

  /** The address of a seller to search by. */
  seller?: PublicKey;

  /**
   * The address of metadata to search by.
   * Ignored when mint provided.
   */
  metadata?: PublicKey;

  /** The address of a mint to search by. */
  mint?: PublicKey;
};

/**
 * @group Operations
 * @category Outputs
 */
export type FindListingsOutput = (Listing | LazyListing)[];

/**
 * @group Operations
 * @category Handlers
 */
export const findListingsOperationHandler: OperationHandler<FindListingsOperation> =
  {
    handle: async (
      operation: FindListingsOperation,
      metaplex: Metaplex,
      scope: OperationScope
    ): Promise<FindListingsOutput> => {
      const { commitment, programs } = scope;
      const { auctionHouse, seller, metadata, mint } = operation.input;
      const auctionHouseProgram = metaplex.programs().getAuctionHouse();
      let listingQuery = new ListingReceiptGpaBuilder(
        metaplex,
        auctionHouseProgram.address
      )
        .mergeConfig({ commitment })
        .whereAuctionHouse(auctionHouse.address);

      if (seller) {
        listingQuery = listingQuery.whereSeller(seller);
      }

      if (metadata && !mint) {
        listingQuery = listingQuery.whereMetadata(metadata);
      }

      if (mint) {
        listingQuery = listingQuery.whereMetadata(
          metaplex.nfts().pdas().metadata({ mint, programs })
        );
      }

      scope.throwIfCanceled();

      return listingQuery.getAndMap((account) =>
        toLazyListing(toListingReceiptAccount(account), auctionHouse)
      );
    },
  };
