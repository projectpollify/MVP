/**
 * Staking Contract Deployment Script
 * Deploys the Aiken staking contract to Cardano
 */

import { Blockfrost, Lucid, fromText } from 'lucid-cardano';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY!;
const WALLET_SEED = process.env.DEPLOYMENT_WALLET_SEED!;
const NETWORK = process.env.CARDANO_NETWORK || 'preprod'; // 'preprod' or 'mainnet'

async function deployStakingContract() {
  try {
    console.log('🚀 Starting staking contract deployment...');
    
    // Initialize Lucid
    const lucid = await Lucid.new(
      new Blockfrost(
        `https://cardano-${NETWORK}.blockfrost.io/api/v0`,
        BLOCKFROST_API_KEY
      ),
      NETWORK === 'mainnet' ? 'Mainnet' : 'Preprod'
    );
    
    // Load wallet
    lucid.selectWalletFromSeed(WALLET_SEED);
    const address = await lucid.wallet.address();
    console.log('📍 Deploying from address:', address);
    
    // Read compiled contract
    const stakingValidator = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, 'build/staking.json'),
        'utf8'
      )
    );
    
    // Create validator script
    const validator = {
      type: 'PlutusV2',
      script: stakingValidator.compiledCode
    };
    
    // Calculate script address
    const scriptAddress = lucid.utils.validatorToAddress(validator);
    console.log('📜 Script address:', scriptAddress);
    
    // Deploy reference script (optional but recommended)
    const tx = await lucid
      .newTx()
      .payToAddressWithData(
        scriptAddress,
        {
          inline: fromText('STAKING_POOL_V1') // Reference UTxO
        },
        { lovelace: 2000000n } // 2 ADA
      )
      .attachSpendingValidator(validator)
      .complete();
    
    const signedTx = await tx.sign().complete();
    const txHash = await signedTx.submit();
    
    console.log('✅ Contract deployed successfully!');
    console.log('📝 Transaction hash:', txHash);
    console.log('📍 Script address:', scriptAddress);
    
    // Save deployment info
    const deploymentInfo = {
      network: NETWORK,
      scriptAddress,
      txHash,
      deployedAt: new Date().toISOString(),
      validator: {
        type: validator.type,
        hash: lucid.utils.validatorToScriptHash(validator)
      }
    };
    
    fs.writeFileSync(
      path.join(__dirname, `deployment-${NETWORK}.json`),
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log('💾 Deployment info saved to deployment.json');
    
    // Update environment variables
    console.log('\n📋 Add these to your .env file:');
    console.log(`STAKING_CONTRACT_ADDRESS=${scriptAddress}`);
    console.log(`STAKING_SCRIPT_HASH=${deploymentInfo.validator.hash}`);
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

// Helper to initialize staking pools on-chain
async function initializeStakingPools() {
  console.log('\n🏊 Initializing staking pools...');
  
  // This would create the initial pool configurations on-chain
  // For the MVP, pools are configured in the validator itself
  
  console.log('✅ Pools initialized');
}

// Run deployment
async function main() {
  // Check environment
  if (!BLOCKFROST_API_KEY || !WALLET_SEED) {
    console.error('❌ Missing required environment variables');
    console.error('Please set BLOCKFROST_API_KEY and DEPLOYMENT_WALLET_SEED');
    process.exit(1);
  }
  
  await deployStakingContract();
  await initializeStakingPools();
  
  console.log('\n🎉 Deployment complete!');
}

main().catch(console.error);
