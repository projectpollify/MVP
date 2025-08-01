// Pollify Staking Contract
// Handles PCO token staking with time locks and rewards

use aiken/dict
use aiken/hash.{Blake2b_224, Hash}
use aiken/interval.{Finite}
use aiken/list
use aiken/time.{PosixTime}
use aiken/transaction.{ScriptContext, Spend, Transaction, ValidityRange}
use aiken/transaction/credential.{VerificationKey, Address}
use aiken/transaction/value

// Types
type PoolId = Int

type StakeId = ByteArray

type WalletAddress = Hash<Blake2b_224, VerificationKey>

// Datum structure for stakes
type StakeDatum {
  stake_id: StakeId,
  owner: WalletAddress,
  pool_id: PoolId,
  amount: Int,
  stake_time: PosixTime,
  unlock_time: PosixTime,
  apr_rate: Int, // Stored as basis points (300 = 3%)
  penalty_rate: Int, // Stored as basis points (5000 = 50%)
}

// Redeemer actions
type StakeRedeemer {
  Unstake
  UnstakeEarly
}

// Pool configuration (hardcoded for MVP)
fn get_pool_config(pool_id: PoolId) -> (Int, Int, Int) {
  // Returns (lock_days, apr_rate, penalty_rate) in basis points
  when pool_id is {
    1 -> (7, 300, 5000)      // 7 days, 3% APR, 50% penalty
    2 -> (30, 400, 6000)     // 30 days, 4% APR, 60% penalty
    3 -> (90, 500, 7000)     // 90 days, 5% APR, 70% penalty
    4 -> (180, 600, 8000)    // 180 days, 6% APR, 80% penalty
    5 -> (365, 700, 9000)    // 365 days, 7% APR, 90% penalty
    _ -> error @"Invalid pool ID"
  }
}

// Calculate rewards based on time staked
fn calculate_rewards(
  amount: Int,
  apr_rate: Int,
  days_staked: Int,
) -> Int {
  // Formula: reward = amount * (apr_rate / 10000) * (days_staked / 365)
  amount * apr_rate * days_staked / (10000 * 365)
}

// Calculate penalty for early exit
fn calculate_penalty(reward_amount: Int, penalty_rate: Int) -> Int {
  reward_amount * penalty_rate / 10000
}

// Validator function
validator staking_validator {
  fn stake(datum: StakeDatum, redeemer: StakeRedeemer, ctx: ScriptContext) -> Bool {
    expect Spend(output_ref) = ctx.purpose
    let tx: Transaction = ctx.transaction
    
    // Get current time from validity range
    expect Finite(lower_bound) = tx.validity_range.lower_bound.bound_type
    let current_time = lower_bound
    
    when redeemer is {
      Unstake -> {
        // Normal unstake - check if lock period has passed
        expect current_time >= datum.unlock_time
        
        // Calculate full rewards
        let days_staked = (current_time - datum.stake_time) / 86400000 // Convert ms to days
        let reward_amount = calculate_rewards(datum.amount, datum.apr_rate, days_staked)
        let total_payout = datum.amount + reward_amount
        
        // Verify the transaction pays the correct amount to the owner
        verify_payout(tx, datum.owner, total_payout)
      }
      
      UnstakeEarly -> {
        // Early exit - apply penalty
        expect current_time < datum.unlock_time
        
        // Calculate rewards up to current time
        let days_staked = (current_time - datum.stake_time) / 86400000
        let reward_amount = calculate_rewards(datum.amount, datum.apr_rate, days_staked)
        
        // Apply penalty to rewards only
        let penalty = calculate_penalty(reward_amount, datum.penalty_rate)
        let net_reward = reward_amount - penalty
        let total_payout = datum.amount + net_reward
        
        // Verify the transaction pays the correct amount to the owner
        verify_payout(tx, datum.owner, total_payout) && 
        // Verify penalty is burned (sent to null address)
        verify_burn(tx, penalty)
      }
    }
  }
}

// Helper function to verify payout to owner
fn verify_payout(tx: Transaction, owner: WalletAddress, amount: Int) -> Bool {
  // Find outputs going to the owner
  let owner_outputs =
    list.filter(
      tx.outputs,
      fn(output) {
        when output.address.payment_credential is {
          credential.VerificationKeyCredential(pkh) -> pkh == owner
          _ -> False
        }
      },
    )
  
  // Sum PCO tokens in owner outputs
  let total_pco_paid =
    list.foldl(
      owner_outputs,
      0,
      fn(output, acc) {
        let pco_amount = get_pco_amount(output.value)
        acc + pco_amount
      },
    )
  
  total_pco_paid >= amount
}

// Helper function to verify tokens are burned
fn verify_burn(tx: Transaction, amount: Int) -> Bool {
  // In Cardano, we typically burn by sending to a script that always fails
  // For MVP, we'll verify tokens are sent to a known burn address
  let burn_outputs =
    list.filter(
      tx.outputs,
      fn(output) { is_burn_address(output.address) },
    )
  
  let total_burned =
    list.foldl(
      burn_outputs,
      0,
      fn(output, acc) {
        let pco_amount = get_pco_amount(output.value)
        acc + pco_amount
      },
    )
  
  total_burned >= amount
}

// Helper to extract PCO amount from value
fn get_pco_amount(val: value.Value) -> Int {
  // PCO token policy ID would be set during deployment
  expect Some(pco_amount) = 
    value.quantity_of(val, pco_policy_id(), pco_asset_name())
  pco_amount
}

// Placeholder functions - would be configured during deployment
fn pco_policy_id() -> value.PolicyId {
  // This would be the actual PCO token policy ID
  #"1234567890abcdef1234567890abcdef1234567890abcdef12345678"
}

fn pco_asset_name() -> value.AssetName {
  // PCO token name
  #"50434f" // "PCO" in hex
}

fn is_burn_address(addr: Address) -> Bool {
  // Check if address is the designated burn address
  // This would be configured during deployment
  False
}

// Additional validator for creating stakes
validator create_stake {
  fn create(pool_id: PoolId, lock_period: Int, ctx: ScriptContext) -> Bool {
    // Verify pool ID is valid
    expect (lock_days, apr_rate, penalty_rate) = get_pool_config(pool_id)
    
    // Verify lock period matches pool configuration
    lock_period == lock_days
  }
}
