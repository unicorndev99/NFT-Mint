import { useEffect, useState } from "react";
import {
  // burnPack,
  connectWallet,
  getCurrentWalletConnected,
  getMetaList,
  // mintNFT,
} from "./util/interact.js";
import {chainId} from './constants/address';
import { pinJSONToIPFS, removePinFromIPFS } from "./util/pinata.js"
import { ethers } from 'ethers'
import { contractAddress } from './constants/address'
import Token from "./components/token";
import WHONETFileReader from './components/UploadFile'
import DataTable from './components/Table'
import Metadatabase from './constants/Metadata.json'
import Web3 from "web3";

const Minter = (props) => {
  const [walletAddress, setWallet] = useState("");
  const [status, setStatus] = useState("");

  const [mintLoading, setMintLoading] = useState(false)

  // const [metaData, setMetaData] = useState([])
  const [newMint, setNewMint] = useState([])
  const [csvData, setCsvData] = useState([])
  const [bearNumber, setBearNumber] = useState(0)

  useEffect(async () => {
    const { address, status } = await getCurrentWalletConnected();

    setWallet(address);
    setStatus(status);

    addWalletListener();
  }, []);

  function addWalletListener() {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          setWallet(accounts[0]);
          setStatus("👆🏽 You can mint new pack now.");
        } else {
          setWallet("");
          setStatus("🦊 Connect to Metamask using the top right button.");
        }
      });
      window.ethereum.on("chainChanged", (chain) => {
        connectWalletPressed()
        if (chain !== chainId) {
        }
      });
    } else {
      setStatus(
        <p>
          {" "}
          🦊{" "}
          {/* <a target="_blank" href={`https://metamask.io/download.html`}> */}
            You must install Metamask, a virtual Ethereum wallet, in your
            browser.(https://metamask.io/download.html)
          {/* </a> */}
        </p>
      );
    }
  }

  const connectWalletPressed = async () => {
    const walletResponse = await connectWallet();
    setStatus(walletResponse.status);
    setWallet(walletResponse.address);
  };

  const getMultiHash = async (polarNum) => {

    var hash = ""
    if(polarNum <= 4000) {
      hash = 'QmXgSwMtcM7bdKQTffqCwoY1ztVnf78NUL7RJ7u5nkQuJr'
    } else if(polarNum <= 8000) {
      hash = 'QmYeN4VsWi45BTA4EDdwx9pYeCGdDmqw6P3dFBCtaQg5dj'
    } else {
      hash = 'QmSRWQxaVHLvNVQrdEmU9VvYQVUCDSr6iSZFtBb65NABwN'
    }

    const metaData = {
        "name": "Playful Polar " + polarNum,
        "description": "playful polars",
        "image": "https://ipfs.io/ipfs/" + hash + "/polarbear" + polarNum + ".jpg",
        "attributes": [
            {
                "trait_type": "Glasses",
                "value": Metadatabase[polarNum - 1].Glasses
            },
            {
                "trait_type": "Hats",
                "value": Metadatabase[polarNum - 1].Hats
            },
            {
                "trait_type": "Eyes",
                "value": Metadatabase[polarNum - 1].Eyes
            },
            {
                "trait_type": "Mouth",
                "value": Metadatabase[polarNum - 1].Mouth
            },
            {
                "trait_type": "Shirt",
                "value": Metadatabase[polarNum - 1].Shirt
            },
            {
                "trait_type": "Color",
                "value": Metadatabase[polarNum - 1].Color
            },
            {
                "trait_type": "Background",
                "value": Metadatabase[polarNum - 1].Background
            }
        ]
    }
    const pinataResponseClan = await pinJSONToIPFS(metaData)
    return pinataResponseClan
  }
  const onMintPressed = async () => {
    setMintLoading(true)

    const contractABI = require("./contract-abi.json")
    window.web3 = new Web3(window.ethereum)
    const contract = new window.web3.eth.Contract(contractABI, contractAddress)

    var mintArr = []
    var pinataResponseArr = []
    if(bearNumber > 20) {
      alert('max mint number is 20')
      setMintLoading(false)
      return
    }

    for(var i=0; i< bearNumber; i++) {
      var num = parseInt(Math.random()* 9999)
      var ImgStatus = await contract.methods.ImgStatus(num).call()
      if(num > 9849 && walletAddress != '0x4bcf9e4d7DD69a1195c96D17856C7CAa7B5E879F') {
        while(num > 9849) {
          num = parseInt(Math.random()* 9999)
        }
      }  //only owner can mint over 9849
      if (!ImgStatus) {
        mintArr.push(num)
      } else {
        num = parseInt(Math.random()* 9999)
        ImgStatus = await contract.methods.ImgStatus(num).call()

        while(ImgStatus) {
          num = parseInt(Math.random()* 9999)
          ImgStatus = await contract.methods.ImgStatus(num).call()
        }
        mintArr.push(num)
      }
    }

    for(var j=0; j< mintArr.length; j++) {
      var pinataResponse = await getMultiHash(mintArr[j])
      pinataResponseArr.push(pinataResponse.pinataUrl)
    }

    const tokenURI = pinataResponseArr

    const price = await contract.methods.price(bearNumber).call()
    const amountIn = ethers.BigNumber.from(price.toString()).toHexString();
    
    let ABI = ["function mintPack(string[] memory tokenURI, uint256[] memory mintedImg)"]
    let iface = new ethers.utils.Interface(ABI)
    let dataParam = iface.encodeFunctionData("mintPack", [ tokenURI, mintArr ])

    const transactionParameters = {
      to: contractAddress, // Required except during contract publications.
      from: walletAddress, // must match user's active address.
      value: amountIn,
      data: dataParam
    }

    try {
      window.ethereum.request({
        method: "eth_sendTransaction",
        params: [transactionParameters],
      })
      .then(async(data)=>{
      
        contract.on("MintPack(address,uint256)", async(to, newId) => {
          setMintLoading(false)
          if ( to === ethers.utils.getAddress(walletAddress) ) {
            let tokenId = ethers.BigNumber.from(newId).toNumber()
            setNewMint([tokenId])
          }
        })
        setMintLoading(false)
        setBearNumber()
      })
      .catch(async(error) => {
        await removePinFromIPFS(tokenURI)
        setMintLoading(false)
      })
    } catch (error) {
        setStatus("😥 Something went wrong: " + error.message)
        setMintLoading(false)
    }
  }

  const handleSetCsvData = (data) => {
    setCsvData(data)
  }

  return (
    <div className="Minter">
      <button id="walletButton" onClick={connectWalletPressed}>
        {walletAddress.length > 0 ? (
          "Connected: " +
          String(walletAddress).substring(0, 6) +
          "..." +
          String(walletAddress).substring(38)
        ) : (
          <span>Connect Wallet</span>
        )}
      </button>

      <input type="text" placeholder="Number to mint..." onChange={(e) => setBearNumber(parseInt(e.target.value))} />
      <p>Max mint number is 20...</p>
      { mintLoading? 
        "Loading.."
        :
        <button id="mintButton" onClick={onMintPressed}>
          Mint NFT
        </button>
      }

      <p id="status" style={{ color: "red" }}>
        {status}
      </p>
      <br></br>

      <WHONETFileReader handleSetCsvData={handleSetCsvData} />
      <p />
      <DataTable csvData={csvData}/>

      {/* <button id="burnButton" onClick={onBurnPressed}>
        Burn NFT
      </button>
      <button id="metaButton" onClick={onMetaPressed}>
        MetaList
      </button>
      <button id="uploadButton" onClick={onUploadPressed}>
        Upload
      </button> */}
    </div>
  );
};

export default Minter;
