import { BigNumber, Contract, ethers, Wallet } from "ethers";
import { Provider, utils } from "zksync-web3";

const GOVERNANCE_ABI = require("./governance.json");
const GOVERNANCE_ADDRESS = "0x072B450d412053CbF217468aDE590B17c3f7D65E";
const COUNTER_ABI = require("./counter.json");
const COUNTER_ADDRESS = "0x52176014d26A99D15487d908979552506c203BED";

async function main() {
  // Ethereum L1 provider
  const l1Provider = ethers.providers.getDefaultProvider("goerli");

  // Governor wallet
  const wallet = new Wallet(
    "0x6933eb119d883cc214e4bf379d01fd388bf36cbe34eb620634a78fb21c66b013",
    l1Provider
  );

  const govcontract = new Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, wallet);

  // Getting the current address of the zkSync L1 bridge
  const l2Provider = new Provider("https://zksync2-testnet.zksync.dev");
  const zkSyncAddress = await l2Provider.getMainContractAddress();
  // Getting the `Contract` object of the zkSync bridge
  const zkSyncContract = new Contract(
    zkSyncAddress,
    utils.ZKSYNC_MAIN_ABI,
    wallet
  );

  // Encoding the tx data the same way it is done on Ethereum
  const counterInterface = new ethers.utils.Interface(COUNTER_ABI);
  const data = counterInterface.encodeFunctionData("increment", []);

  // The price of the L1 transaction requests depends on the gas price used in the call
  //const gasPrice = await l1Provider.getGasPrice();
  const gasPrice = 800000000000;
  // Here we define the constant for ergs limit
  const ergsLimit = BigNumber.from(1000000);
  // Getting the cost of the execution.
  const baseCost = await zkSyncContract.l2TransactionBaseCost(
    gasPrice,
    ergsLimit,
    ethers.utils.hexlify(data).length
  );

  // Calling the L1 governance contract
  const tx = await govcontract.callZkSync(
    zkSyncAddress,
    COUNTER_ADDRESS,
    data,
    ergsLimit,
    {
      // Passing the necessary ETH `value` to cover the fee for the operation
      value: baseCost,
      gasPrice,
    }
  );

  // Waiting until the L1 tx is complete
  await tx.wait();
  console.log("L1 Transaction Hash is ", tx);

  // Getting the TransactionResponse object for the L2 transaction corresponding to the
  // execution call
  const l2Response = await l2Provider.getL2TransactionFromPriorityOp(tx);

  // The receipt of the L2 transaction corresponding to the call to the Increment contract
  const l2Receipt = await l2Response.wait();

  console.log("L2 Transaction Details ",l2Receipt);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
