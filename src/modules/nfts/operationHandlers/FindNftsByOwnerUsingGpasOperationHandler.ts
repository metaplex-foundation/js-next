import { TokenProgram } from '@/programs';
import { OperationHandler } from '@/shared';
import { Nft } from '../models';
import { FindNftsByMintListOperation, FindNftsByOwnerOperation } from '../operations';

export class FindNftsByOwnerUsingGpasOperationHandler extends OperationHandler<FindNftsByOwnerOperation> {
  public async handle(operation: FindNftsByOwnerOperation): Promise<Nft[]> {
    const owner = operation.input;

    const mints = await TokenProgram.tokenAccounts(this.metaplex.connection)
      .selectMint()
      .whereOwner(owner)
      .whereAmount(1)
      .getDataAsPublicKeys();

    return await this.metaplex.execute(new FindNftsByMintListOperation(mints));
  }
}
