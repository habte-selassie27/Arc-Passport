import { getCircleClient, assertBlockchain } from "../config/circle.js";

const CIRCLE_MAX_RETRIES = 10;
const CIRCLE_RETRY_DELAY = 1500;

export async function executeContractCall(
  walletId: string,
  contractAddress: string,
  abiFunctionSignature: string,
  abiParameters: string[],
  feeLevel: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM"
): Promise<string> {
  const circleClient = getCircleClient();
  assertBlockchain("ARC-TESTNET");

  const tx = await circleClient.createContractExecutionTransaction({
    walletId,
    contractAddress,
    abiFunctionSignature,
    abiParameters,
    fee: { type: "level", config: { feeLevel } },
  });

  const txId = tx.data?.id;
  if (!txId) throw new Error("Circle: no transaction ID returned");

  for (let i = 0; i < CIRCLE_MAX_RETRIES; i++) {
    await new Promise((r) => setTimeout(r, CIRCLE_RETRY_DELAY));
    const { data } = await circleClient.getTransaction({ id: txId });
    const state = data?.transaction?.state;
    if (state === "COMPLETE") return data!.transaction!.txHash!;
    if (state === "FAILED") throw new Error(`Circle: transaction failed (${txId})`);
  }

  throw new Error(`Circle: transaction timed out (${txId})`);
}

export async function getWalletBalance(walletId: string): Promise<string> {
  const circleClient = getCircleClient();
  const { data } = await circleClient.getWalletTokenBalance({ id: walletId });
  return data?.tokenBalances?.[0]?.amount ?? "0";
}
