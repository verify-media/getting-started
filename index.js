const { ethers, Contract, keccak256 } = require("ethers");
const ContentGraphABI = require("./ContentGraphABI.json");
const identityRegistryABI = require("./IdentityRegistryABI.json");
const pinataSDK = require("@pinata/sdk");
const dotenv = require("dotenv");
dotenv.config();

const IDENTITY_PROXY_CONTRACT = "0xdCE27c4a76bE1fF9F9C543E13FCC3591E33A0E25";
const CONTENTGRAPH_PROXY_CONTRACT =
  "0xEe586a3655EB0D017643551e9849ed828Fd7c7FA";
const ZeroHash =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const rpcUrl = "https://rpc.verify-testnet.gelato.digital";

const rpcProvider = new ethers.JsonRpcProvider(rpcUrl)

async function buildDomainSeparator() {
  //Domain separator for Identity Registry Sandbox, see EIP712 specification for more detail.
  const intermediateWallet = new ethers.Wallet(
    process.env.INTER_WALLET,
    rpcProvider
  );
  const IdentityRegistry = new Contract(
    IDENTITY_PROXY_CONTRACT,
    identityRegistryABI,
    intermediateWallet
  );

  const eip = await IdentityRegistry.eip712Domain();

  const domainSepartor = keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        keccak256(
          ethers.toUtf8Bytes(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
          )
        ),
        ethers.id(eip.name),
        ethers.id(eip.version),
        eip.chainId,
        IDENTITY_PROXY_CONTRACT,
      ]
    )
  );
  return domainSepartor;
}

async function registerRoot() {
  console.log("Registering root...");
  const rootWallet = new ethers.Wallet(
    process.env.ROOT_WALLET,
    rpcProvider //
  );

  const intermediateWallet = new ethers.Wallet(
    process.env.INTER_WALLET,
    rpcProvider
  );

  const IdentityRegistry = new Contract(
    IDENTITY_PROXY_CONTRACT,
    identityRegistryABI,
    intermediateWallet
  );

  console.log(await IdentityRegistry.getAddress());

  await IdentityRegistry.registerRoot(rootWallet.address, `MOCK_PUBLISHER_${new Date().getTime()}`);
  console.log("Root registered!");
}

async function createRegisterSignature(
  IdentityRegistry,
  rootWallet,
  intermediate,
  expiry,
  chainId,
  deadline
) {
  console.log("Getting nonce...");
  const nonce = await IdentityRegistry.nonces(rootWallet.address);

  const structData = ethers.AbiCoder.defaultAbiCoder().encode(
    [
      "bytes32",
      "address",
      "address",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
    ],
    [
      keccak256(
        ethers.toUtf8Bytes(
          "register(address root,address intermediate,uint256 expiry,uint256 nonce,uint256 chainID,uint256 deadline)"
        )
      ), //This is the hash of the register function type
      rootWallet.address, // Root Address
      intermediate.address, // Intermediate Address
      expiry, // Expiry of registration
      nonce, // nonce
      chainId,
      deadline, // Expiry of the signature
    ]
  );
  const structHash = keccak256(structData);

  console.log(`Sign message: ${structHash}`);

  const DOMAIN_SEPARATOR = await buildDomainSeparator();

  const signature = rootWallet.signingKey.sign(
    keccak256(
      "0x1901" + DOMAIN_SEPARATOR.substring(2) + structHash.substring(2) //Note: "0x1901 is the set prefix for EIP712, see its specification for more detail"
    )
  ).serialized;

  return signature;
}

async function registerIntermediate() {
  const rootWallet = new ethers.Wallet(
    process.env.ROOT_WALLET,
    rpcProvider //
  );

  const intermediateWallet = new ethers.Wallet(
    process.env.INTER_WALLET,
    rpcProvider
  );
  const IdentityRegistry = new Contract(
    IDENTITY_PROXY_CONTRACT,
    identityRegistryABI,
    intermediateWallet
  );

  const now = (await rpcProvider.getBlock()).timestamp;

  const expiry = now + 60 * 60 * 24 * 3; // 3 day: 60 secs by 60 mins by 24 hrs
  const deadline = now + 60 * 60 * 24;
  const chainId = 1833;

  console.log("Generating signature...");

  const signature = await createRegisterSignature(
    IdentityRegistry,
    rootWallet,
    intermediateWallet,
    expiry,
    chainId,
    deadline
  );

  console.log(`Signature generated: ${signature}`);
  console.log("Registering intermediate...");
  await IdentityRegistry.register(
    signature,
    rootWallet.address,
    intermediateWallet.address,
    expiry,
    chainId,
    deadline
  );

  console.log("Intermediate wallet registered!");
}

async function whoIs(address = "") {
  const intermediate = new ethers.Wallet(
    process.env.INTER_WALLET,
    rpcProvider
  );
  if (!address) {
    address = intermediate.address;
  }

  const IdentityRegistry = new Contract(
    IDENTITY_PROXY_CONTRACT,
    identityRegistryABI,
    intermediate
  );

  console.log("Who is:", address);
  return IdentityRegistry.whoIs(address);
}

// create a free account on pinata.cloud (https://www.pinata.cloud/pricing) and get the key and secret
async function uploadToIPFS(metadata) {
  const pinata = new pinataSDK(
    process.env.PINATA_KEY,
    process.env.PINATA_SECRET
  );

  const pinataResp = await pinata.pinJSONToIPFS(metadata, {
    pinataMetadata: {
      name: "sandbox-verify",
    },
    pinataOptions: {
      cidVersion: 1,
    },
  });
  return pinataResp.IpfsHash;
}

function generateRandomString(length) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function signMetadata(metadata) {
  const intermediate = new ethers.Wallet(
    process.env.INTER_WALLET,
    rpcProvider
  );

  const metadataString = JSON.stringify(metadata.data);
  const message = keccak256(ethers.toUtf8Bytes(metadataString));
  const signature = intermediate.signingKey.sign(message).serialized;

  return {
    curve: "sepc256k1",
    signature: signature,
    message: message,
    description: "Signer attesting to the contents of this metadata file.",
  };
}

async function publishContent() {
  const intermediate = new ethers.Wallet(
    process.env.INTER_WALLET,
    rpcProvider
  );

  const random_content = generateRandomString(10);
  console.log("Publishing content: ", { text: random_content });

  const newAssetId = keccak256(ethers.toUtf8Bytes(random_content));
  console.log(`AssetId: ${newAssetId}`);

  console.log("Storing Content...");
  const contentCID = await uploadToIPFS({ text: random_content });
  console.log("Stored content at: ipfs://");

  const metadata = {
    data: {
      description: "A random piece of content.",
      encrypted: false,
      access: {},
      content: [
        {
          location: `ipfs://${contentCID}`,
          type: "text/plain",
        },
      ],
      manifest: {},
      contentBinding: {
        algo: "keccak256", //The algorithm used
        hash: newAssetId, //The Asset ID we generated
      },
    },
  };

  console.log("Signing metadata...");
  const signature = signMetadata(metadata);
  metadata.signature = signature;
  console.log("Metadata signed");

  const ipfsHash = await uploadToIPFS(metadata);
  console.log(`Uploaded to ipfs: ${ipfsHash}`);

  const ContentGraph = new Contract(
    CONTENTGRAPH_PROXY_CONTRACT,
    ContentGraphABI,
    intermediate
  );

  console.log("Publishing to the ContentGraph...");
  const txn = await ContentGraph.publish(
    ZeroHash, // Using the root as parent bytes32(0)
    {
      id: newAssetId, // The Asset ID we calculated in step 3.1
      nodeType: 2, // NodeType 2 == NodeType.ASSET
      referenceOf: ZeroHash,
      uri: `ipfs://${ipfsHash}`,
    }
  );

  console.log(`Transaction hash: ${txn.hash}`);
  await txn.wait();
  console.log("******** content published ********");

  return {
    hash: txn.hash,
    assetId: newAssetId,
    metadata: metadata,
  };
}

async function fetchFileFromIPFS(cid) {
  const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
  const response = await fetch(url);
  let data = null;
  data = await response.json();
  data = JSON.stringify(data);
  return data;
}

async function consumeContent(assetId) {
  const intermediate = new ethers.Wallet(
    process.env.INTER_WALLET,
    rpcProvider
  );

  const ContentGraph = new Contract(
    CONTENTGRAPH_PROXY_CONTRACT,
    ContentGraphABI,
    intermediate
  );

  const dataFromChain = await ContentGraph.getNode(assetId);

  console.log("Data uri: ", dataFromChain[4]);
  let metadata = await fetchFileFromIPFS(dataFromChain[4].split("//")[1]);
  metadata = JSON.parse(metadata);

  //match the hash of the metadata with the hash of the data from chain
  if (assetId === metadata.data.contentBinding.hash) {
    console.log("Content binding matched!");
  }

  const metadataString = JSON.stringify(metadata.data);
  const calculatedMessage = ethers.keccak256(
    ethers.toUtf8Bytes(metadataString)
  );

  const signatureMessage = metadata.signature.message;

  if (calculatedMessage === signatureMessage) {
    console.log("Signature message matched!");
  }

  const address = ethers.recoverAddress(
    calculatedMessage,
    metadata.signature.signature
  );
  console.log("Address recovered from signature: ", address);

  const rootAddress = await whoIs(address);
  console.log("Root address mapped to: ", rootAddress);

  console.log("******** content verified ********");
}

async function main() {
  /**
   * remember to fund the intermediate wallet following steps mentioned in https://docs.verifymedia.com/verify-testnet before calling any of the below functions
   */

  // Register Root: Needs to be run only once
  await registerRoot();

  // Wait for the root registration to be mined
  console.log("Waiting for root registration...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Register Intermediate: Needs to be run only once
  await registerIntermediate();

  // console.log("Waiting for signer registration...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Check the registration of the Intermediate, should return Root address
  const root = await whoIs();
  console.log(root);

  // Publish a random string as content.
  const { assetId } = await publishContent();

  // Verify content published
  await consumeContent(assetId);
  console.log(
    `\nCheck latest transactions at https://verify-testnet.blockscout.com/address/${CONTENTGRAPH_PROXY_CONTRACT}`
  );
}

main();
