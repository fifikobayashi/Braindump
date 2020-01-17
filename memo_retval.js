/*
 * This example demonstrates the: 
 * 	- retrieval of an onchain memo via the blockpress decoder
 * 	- new expanded error handles in CashScript 0.3.1
 *	- usage of FailedRequireError to enable a more specific boolean outcome to be returned from contract to JS 
 * 
 * Note: ensure your CashScript SDK /cashc is updated to 0.3.1
 */

const { BITBOX } = require('bitbox-sdk');
const { Contract, Sig, FailedRequireError, FailedSigCheckError, FailedTransactionError } = require('cashscript');
const path = require('path');
const localTokenId = 'ec10a63a4067dff85a8ba9256dd0c9a86f25f9a4191b7411a54f5c2fdfd19221';
const decodeString = 'OP_RETURN 653 6a028d024065633130613633613430363764666638356138626139323536646430633961383666323566396134313931623734313161353466356332666466643139323231';

run();
async function run() {
  // Initialise BITBOX
  const network = 'testnet';
  const bitbox = new BITBOX({ restURL: 'https://trest.bitcoin.com/v2/' });

  // Initialise HD node and alice's keypair
  const rootSeed = bitbox.Mnemonic.toSeed('Gym Friend');
  const hdNode = bitbox.HDNode.fromSeed(rootSeed, network);
  const alice = bitbox.HDNode.toKeyPair(bitbox.HDNode.derive(hdNode, 0));

  // Derive alice's public key and public key hash
  const alicePk = bitbox.ECPair.toPublicKey(alice);
  const alicePkh = bitbox.Crypto.hash160(alicePk);

  // Compile the P2PKH Cash Contract
  const P2PKH = Contract.compile(path.join(__dirname, 'memo_retval.cash'), network);

  // Instantiate a new P2PKH contract with constructor arguments: { pkh: alicePkh }
  const instance = P2PKH.new(alicePkh);

  // Get contract balance & output address + balance
  const contractBalance = await instance.getBalance();
  console.log('contract address:', instance.address);
  console.log('contract balance:', contractBalance);
 
  // Retrieves the message from onchain via blockpress decode using the tx ID from posting the memo above
  let memopress = require('memopress');
  var memo = memopress.decode(decodeString).message;
  
  // String op to extract the token ID from the retrieved memo
  const onchainTokenId = memo.split('@').pop();
  console.log('Token ID retrieved from on-chain: ' + onchainTokenId);

  // Calls the contract's token validation function to compare the local token ID with the onchain ID
  // (i.e. ensure the token ID received via frontend logic matches the ID permanently stored on-chain
  // Then if the token IDs match, send 0. 000 000 10 BCH back to the contract's address
    try {
    const tx = await instance.functions.validateTokenId(localTokenId, onchainTokenId).send(instance.address, 10);
    console.log('transaction details:', tx);
    console.log('***Local Token ID successfully matched the Token ID stored onchain***');
  } catch (e) {
	if (e instanceof FailedRequireError) {
		console.log('Error: Local Token ID did not match the Token ID stored onchain');
	} else if (e instanceof FailedTransactionError) {
		console.log('Error: The send transaction failed');
	} else if (e instanceof FailedSigCheckError) {
		console.log('Error: The sender\'s signature failed validation');
	}
	else {
		console.log('Some other shit happened');
	}
  }
}

module.exports = {
  run,
};
