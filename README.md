## Verify

This is a sample app to check basic features of verify.

Please refer to the [Getting Started](https://docs.verifymedia.com) guide for more info.

## Network
VERIFY Protocol is deployed on an Polygon CDK validium based appchain. 

```
Network Name: VERIFY Testnet
RPC URL: https://rpc.verify-testnet.gelato.digital
Chain ID: 1833
Currency Symbol: MATIC
Block Explorer URL: https://verify-testnet.blockscout.com/
Settlement Layer: Amoy 
```

more details can be found [here](https://docs.verifymedia.com/verify-testnet).

## Setup

- Install the required dependencies by running npm install.
- Create a .env file in the root directory and add the following environment variables:
  - ROOT_WALLET: Your root wallet <b>private key. </b>

  (<i>you can generate a wallet using the gen-wallet.js file</i>):

    ```node gen-wallet.js```  
  - INTER_WALLET: Your intermediate wallet <b>private key</b>.
  
  (<i>you can generate a wallet using the gen-wallet.js file</i>):

    ```node gen-wallet.js```  
  - PINATA_KEY: Your Pinata key.

  - PINATA_SECRET: Your Pinata secret.

## Usage

this project contains several functions that interact with the Ethereum blockchain:

- registerRoot(): Registers the root wallet. <b>to be called only once per root and intermediate wallet combo</b>
- registerInterMediate(): Registers the intermediate - wallet. <b>to be called only once per root and intermediate wallet combo</b>
- whoIs(): Returns the root wallet address associated with a given address.
- publishContent(): Publishes content to IPFS and the blockchain.
- consumeContent(): Verifies the content published on the blockchain.

To run the project, use the command node index.js.

## Note:

remember to fund the intermediate wallet following steps mentioned in [here](https://docs.verifymedia.com/verify-testnet) before calling any of the functions
