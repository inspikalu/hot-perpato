use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use ephemeral_rollups_sdk::anchor::{action, commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;
use ephemeral_rollups_sdk::{ActionArgs, CallHandler, ShortAccountMeta};

declare_id!("9y5B6n8Lq8HipGsuwE7TrTW31y8T49xtFrZstYJeEV5w");

pub const GAME_SEED: &[u8] = b"hot_perp_game";
pub const ESCROW_SEED: &[u8] = b"hot_perp_escrow";
pub const MAX_PLAYERS: usize = 4;
pub const ROUND_TIME: i64 = 30;

#[account]
pub struct Game {
    pub authority: Pubkey,
    pub players: Vec<Player>,
    pub state: GameState,
    pub config: GameConfig,
    pub current_holder: u8,
    pub round: u8,
    pub timer_deadline: i64,
}

impl Game {
    pub fn size(max_players: u8) -> usize {
        8 + 32 + 4 + (max_players as usize) * Player::SIZE + 1 + GameConfig::SIZE + 1 + 1 + 8
    }
}

#[account]
pub struct Player {
    pub wallet: Pubkey,
    pub score: i32,
    pub passes_made: u32,
    pub rounds_survived: u32,
    pub liquidations_caused: u32,
}

impl Player {
    pub const SIZE: usize = 32 + 4 + 4 + 4 + 4;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum GameState {
    Waiting,
    Active,
    Exploded,
    Finished,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum StakeMode {
    Free,
    BuyIn,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct GameConfig {
    pub max_players: u8,
    pub total_rounds: u8,
    pub stake_mode: StakeMode,
    pub buy_in_amount: u64,
}

impl GameConfig {
    pub const SIZE: usize = 1 + 1 + 1 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum GameError {
    #[msg("Game is not in waiting state")]
    NotWaiting,
    #[msg("Game is not in active state")]
    NotActive,
    #[msg("Game is full")]
    LobbyFull,
    #[msg("You are not the current holder")]
    NotHolder,
    #[msg("Timer has not expired yet")]
    TimerNotExpired,
    #[msg("Insufficient escrow balance")]
    InsufficientEscrow,
    #[msg("Player already in game")]
    AlreadyJoined,
    #[msg("Invalid player index")]
    InvalidPlayerIndex,
    #[msg("Game is over")]
    GameOver,
    #[msg("Not enough players to start")]
    NotEnoughPlayers,
    #[msg("Wrong stake mode for this operation")]
    WrongStakeMode,
}

#[event]
pub struct PassEvent {
    pub from: Pubkey,
    pub to: Pubkey,
    pub remaining_seconds: i64,
}

#[event]
pub struct ExplosionEvent {
    pub holder: Pubkey,
    pub holder_idx: u8,
    pub round: u8,
}

#[event]
pub struct RoundStartEvent {
    pub round: u8,
    pub holder_idx: u8,
}

// ── Base Layer Contexts (L1) ──

#[derive(Accounts)]
pub struct CreateGame<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Game::size(MAX_PLAYERS as u8),
        seeds = [GAME_SEED, user.key().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinGame<'info> {
    #[account(mut, seeds = [GAME_SEED, game.authority.as_ref()], bump)]
    pub game: Account<'info, Game>,
    pub player: Signer<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateGame<'info> {
    pub payer: Signer<'info>,
    #[account(mut, del)]
    pub game: UncheckedAccount<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateEscrow<'info> {
    pub payer: Signer<'info>,
    #[account(mut, del)]
    pub escrow_token_account: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct DepositBuyIn<'info> {
    #[account(mut, seeds = [GAME_SEED, game.authority.as_ref()], bump)]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub player_usdc: Account<'info, TokenAccount>,
    #[account(mut, seeds = [ESCROW_SEED, game.key().as_ref()], bump)]
    pub escrow_usdc: Account<'info, TokenAccount>,
    pub player: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ── Ephemeral Rollup Contexts ──

#[derive(Accounts)]
pub struct StartRound<'info> {
    #[account(mut, seeds = [GAME_SEED, game.authority.as_ref()], bump)]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct PassPotato<'info> {
    #[account(mut, seeds = [GAME_SEED, game.authority.as_ref()], bump)]
    pub game: Account<'info, Game>,
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExplodePotato<'info> {
    #[account(mut, seeds = [GAME_SEED, game.authority.as_ref()], bump)]
    pub game: Account<'info, Game>,
}

#[derive(Accounts)]
pub struct EndRound<'info> {
    #[account(mut, seeds = [GAME_SEED, game.authority.as_ref()], bump)]
    pub game: Account<'info, Game>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetGameState<'info> {
    #[account(seeds = [GAME_SEED, game.authority.as_ref()], bump)]
    pub game: Account<'info, Game>,
}

#[derive(Accounts)]
pub struct InitEscrow<'info> {
    #[account(
        init,
        payer = user,
        token::mint = usdc_mint,
        token::authority = game,
        seeds = [ESCROW_SEED, game.key().as_ref()],
        bump
    )]
    pub escrow_usdc: Account<'info, TokenAccount>,
    pub game: Account<'info, Game>,
    pub usdc_mint: Account<'info, anchor_spl::token::Mint>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

// ── Magic Actions (Post-Commit) Contexts ──

#[action]
#[derive(Accounts)]
pub struct PayoutWinner<'info> {
    #[account(mut, seeds = [GAME_SEED, game.authority.as_ref()], bump)]
    pub game: Account<'info, Game>,
    #[account(mut, seeds = [ESCROW_SEED, game.key().as_ref()], bump)]
    pub escrow_usdc: Account<'info, TokenAccount>,
    #[account(mut)]
    pub winner_usdc: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitAndPayout<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [GAME_SEED, game.authority.as_ref()], bump)]
    pub game: Account<'info, Game>,
    #[account(mut, seeds = [ESCROW_SEED, game.key().as_ref()], bump)]
    pub escrow_usdc: Account<'info, TokenAccount>,
    #[account(mut)]
    pub winner_usdc: Account<'info, TokenAccount>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitAndFinish<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [GAME_SEED, game.authority.as_ref()], bump)]
    pub game: Account<'info, Game>,
}

// ── Program ──

#[ephemeral]
#[program]
pub mod hot_perp {

    use super::*;

    // ════════════════════════════════════════════
    // L1 Instructions
    // ════════════════════════════════════════════

    pub fn create_game(ctx: Context<CreateGame>, config: GameConfig) -> Result<()> {
        let game = &mut ctx.accounts.game;
        game.authority = ctx.accounts.user.key();
        game.state = GameState::Waiting;
        game.config = config;
        game.current_holder = 0;
        game.round = 0;
        game.players = Vec::new();
        Ok(())
    }

    pub fn join_game(ctx: Context<JoinGame>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.state == GameState::Waiting, GameError::NotWaiting);
        require!(
            (game.players.len() as u8) < game.config.max_players,
            GameError::LobbyFull
        );

        let player_wallet = ctx.accounts.player.key();
        for p in game.players.iter() {
            require!(p.wallet != player_wallet, GameError::AlreadyJoined);
        }

        game.players.push(Player {
            wallet: player_wallet,
            score: 0,
            passes_made: 0,
            rounds_survived: 0,
            liquidations_caused: 0,
        });
        Ok(())
    }

    pub fn delegate_game(ctx: Context<DelegateGame>) -> Result<()> {
        ctx.accounts
            .delegate_pda(
                &ctx.accounts.payer,
                &[GAME_SEED, ctx.accounts.game.key().as_ref()],
                DelegateConfig {
                    commit_frequency_ms: Some(10_000),
                    ..Default::default()
                },
            )
            .map_err(Into::into)
    }

    pub fn delegate_escrow(ctx: Context<DelegateEscrow>) -> Result<()> {
        ctx.accounts
            .delegate_pda(
                &ctx.accounts.payer,
                &[ESCROW_SEED, ctx.accounts.escrow_token_account.key().as_ref()],
                DelegateConfig::default(),
            )
            .map_err(Into::into)
    }

    pub fn deposit_buy_in(ctx: Context<DepositBuyIn>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.game.config.stake_mode == StakeMode::BuyIn,
            GameError::WrongStakeMode
        );
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player_usdc.to_account_info(),
                    to: ctx.accounts.escrow_usdc.to_account_info(),
                    authority: ctx.accounts.player.to_account_info(),
                },
            ),
            amount,
        )?;
        Ok(())
    }

    pub fn init_escrow(ctx: Context<InitEscrow>) -> Result<()> {
        Ok(())
    }

    // ════════════════════════════════════════════
    // Ephemeral Rollup Instructions (~10ms)
    // ════════════════════════════════════════════

    pub fn start_round(ctx: Context<StartRound>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.state == GameState::Waiting, GameError::NotWaiting);
        require!(
            game.players.len() >= 2,
            GameError::NotEnoughPlayers
        );

        game.round += 1;
        game.state = GameState::Active;

        let idx = (game.round as usize) % game.players.len();
        game.current_holder = idx as u8;
        game.timer_deadline = Clock::get()?.unix_timestamp + ROUND_TIME;

        emit!(RoundStartEvent {
            round: game.round,
            holder_idx: game.current_holder,
        });
        Ok(())
    }

    pub fn pass_potato(ctx: Context<PassPotato>, to_player_idx: u8) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.state == GameState::Active, GameError::NotActive);
        require!(
            game.players[game.current_holder as usize].wallet == ctx.accounts.player.key(),
            GameError::NotHolder
        );
        require!(
            (to_player_idx as usize) < game.players.len(),
            GameError::InvalidPlayerIndex
        );
        require!(
            to_player_idx != game.current_holder,
            GameError::InvalidPlayerIndex
        );

        let from = &mut game.players[game.current_holder as usize];
        from.passes_made += 1;

        let to_wallet = game.players[to_player_idx as usize].wallet;
        game.current_holder = to_player_idx;
        game.timer_deadline = Clock::get()?.unix_timestamp + ROUND_TIME;

        emit!(PassEvent {
            from: ctx.accounts.player.key(),
            to: to_wallet,
            remaining_seconds: ROUND_TIME,
        });
        Ok(())
    }

    pub fn explode_potato(ctx: Context<ExplodePotato>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.state == GameState::Active, GameError::NotActive);
        require!(
            Clock::get()?.unix_timestamp >= game.timer_deadline,
            GameError::TimerNotExpired
        );

        game.state = GameState::Exploded;
        let holder_idx = game.current_holder as usize;

        game.players[holder_idx].score -= 1;
        game.players[holder_idx].liquidations_caused += 1;

        for (i, player) in game.players.iter_mut().enumerate() {
            if i != holder_idx {
                player.score += 1;
                player.rounds_survived += 1;
            }
        }

        emit!(ExplosionEvent {
            holder: game.players[holder_idx].wallet,
            holder_idx: game.current_holder,
            round: game.round,
        });
        Ok(())
    }

    pub fn end_round(ctx: Context<EndRound>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.state == GameState::Exploded, GameError::NotActive);

        if game.round >= game.config.total_rounds {
            game.state = GameState::Finished;
        } else {
            game.state = GameState::Waiting;
        }
        Ok(())
    }

    // ════════════════════════════════════════════
    // Commit + Settlement
    // ════════════════════════════════════════════

    pub fn commit_and_finish(ctx: Context<CommitAndFinish>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        game.state = GameState::Finished;

        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.game.to_account_info()])
        .build_and_invoke()?;

        Ok(())
    }

    pub fn commit_and_payout(ctx: Context<CommitAndPayout>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        game.state = GameState::Finished;

        let winner_idx = game
            .players
            .iter()
            .enumerate()
            .max_by_key(|(_, p)| p.score)
            .map(|(i, _)| i as u8)
            .unwrap_or(0);

        let instruction_data =
            anchor_lang::InstructionData::data(&crate::instruction::PayoutWinner { winner_idx });

        let action_args = ActionArgs::new(instruction_data);

        let action_accounts = vec![
            ShortAccountMeta {
                pubkey: ctx.accounts.game.key().to_bytes().into(),
                is_writable: true,
            },
            ShortAccountMeta {
                pubkey: ctx.accounts.escrow_usdc.key().to_bytes().into(),
                is_writable: true,
            },
            ShortAccountMeta {
                pubkey: ctx.accounts.winner_usdc.key().to_bytes().into(),
                is_writable: true,
            },
            ShortAccountMeta {
                pubkey: anchor_spl::token::ID.to_bytes().into(),
                is_writable: false,
            },
        ];

        let action = CallHandler {
            destination_program: crate::ID,
            accounts: action_accounts,
            args: action_args,
            escrow_authority: ctx.accounts.payer.to_account_info(),
            compute_units: 200_000,
        };

        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.game.to_account_info()])
        .add_post_commit_actions([action])
        .build_and_invoke()?;

        Ok(())
    }

    pub fn payout_winner(ctx: Context<PayoutWinner>, winner_idx: u8) -> Result<()> {
        let game = &ctx.accounts.game;
        let winner_wallet = game.players[winner_idx as usize].wallet;
        require!(
            ctx.accounts.winner_usdc.owner == winner_wallet,
            GameError::InvalidPlayerIndex
        );

        let escrow_bump = anchor_lang::prelude::Pubkey::find_program_address(
            &[ESCROW_SEED, game.key().as_ref()],
            &crate::ID,
        );

        let seeds = &[
            ESCROW_SEED,
            game.key().as_ref(),
            &[escrow_bump.1],
        ];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_usdc.to_account_info(),
                    to: ctx.accounts.winner_usdc.to_account_info(),
                    authority: ctx.accounts.game.to_account_info(),
                },
                signer_seeds,
            ),
            ctx.accounts.escrow_usdc.amount,
        )?;

        Ok(())
    }
}
