import { prisma } from "../../../shared/prisma";
import QueryBuilder from "../../builder/QueryBuilder";
import { userSelect } from "../../helpers/select";

const myWallet = async (userId: string) => {
  const result = await prisma.wallet.findUnique({
    where: { userId },
    include: {
      user: { select: userSelect },
      _count: { select: { transactions: true } },
    },
  });

  return result;
};

const myTransactions = async (userId: string, query: Record<string, any>) => {
  const queryBuilder = new QueryBuilder(query)
    .search(["type", "reason"])
    .filter()
    .sort()
    .paginate();

  const options = queryBuilder.build();

  const wallet = await prisma.wallet.findUnique({ where: { userId } });

  const transactions = await prisma.walletTransaction.findMany({
    ...options,
    where: { walletId: wallet?.id },
  });

  const meta = await queryBuilder.countTotal(prisma.walletTransaction);
  return { transactions, meta };
};

export const walletService = {
  myWallet,
  myTransactions,
};
