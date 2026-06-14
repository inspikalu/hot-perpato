/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/hot_perp.json`.
 */
export type HotPerp = {
  "address": "9y5B6n8Lq8HipGsuwE7TrTW31y8T49xtFrZstYJeEV5w",
  "metadata": {
    "name": "hotPerp",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Hot Perp: Trade or Burn — pass the leveraged perp before it explodes"
  },
  "instructions": [
    {
      "name": "commitAndPayout",
      "discriminator": [
        243,
        159,
        201,
        20,
        126,
        85,
        72,
        69
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  116,
                  95,
                  112,
                  101,
                  114,
                  112,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.authority",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "escrowUsdc",
          "writable": true
        },
        {
          "name": "winnerUsdc",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createGame",
      "discriminator": [
        124,
        69,
        75,
        66,
        184,
        220,
        72,
        206
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  116,
                  95,
                  112,
                  101,
                  114,
                  112,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "arg",
                "path": "config.game_id"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "config",
          "type": {
            "defined": {
              "name": "gameConfig"
            }
          }
        }
      ]
    },
    {
      "name": "delegateEscrow",
      "discriminator": [
        85,
        42,
        67,
        11,
        205,
        0,
        187,
        96
      ],
      "accounts": [
        {
          "name": "payer",
          "signer": true
        },
        {
          "name": "bufferEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "escrow"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                133,
                58,
                189,
                140,
                116,
                224,
                235,
                244,
                196,
                76,
                21,
                17,
                19,
                42,
                196,
                106,
                243,
                234,
                200,
                197,
                206,
                83,
                152,
                179,
                83,
                144,
                152,
                240,
                131,
                196,
                167,
                70
              ]
            }
          }
        },
        {
          "name": "delegationRecordEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "escrow"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "escrow"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "escrow",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "9y5B6n8Lq8HipGsuwE7TrTW31y8T49xtFrZstYJeEV5w"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "delegateGame",
      "discriminator": [
        116,
        183,
        70,
        107,
        112,
        223,
        122,
        210
      ],
      "accounts": [
        {
          "name": "payer",
          "signer": true
        },
        {
          "name": "bufferGame",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "game"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                133,
                58,
                189,
                140,
                116,
                224,
                235,
                244,
                196,
                76,
                21,
                17,
                19,
                42,
                196,
                106,
                243,
                234,
                200,
                197,
                206,
                83,
                152,
                179,
                83,
                144,
                152,
                240,
                131,
                196,
                167,
                70
              ]
            }
          }
        },
        {
          "name": "delegationRecordGame",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "game"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataGame",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "game"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "game",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "9y5B6n8Lq8HipGsuwE7TrTW31y8T49xtFrZstYJeEV5w"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "depositBuyIn",
      "discriminator": [
        71,
        217,
        42,
        132,
        19,
        182,
        64,
        55
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  116,
                  95,
                  112,
                  101,
                  114,
                  112,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.authority",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "playerUsdc",
          "writable": true
        },
        {
          "name": "escrowUsdc",
          "writable": true
        },
        {
          "name": "player",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "endRound",
      "discriminator": [
        54,
        47,
        1,
        200,
        250,
        6,
        144,
        63
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  116,
                  95,
                  112,
                  101,
                  114,
                  112,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.authority",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "explodePotato",
      "discriminator": [
        118,
        147,
        14,
        77,
        9,
        4,
        97,
        149
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  116,
                  95,
                  112,
                  101,
                  114,
                  112,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.authority",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "game"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "joinGame",
      "discriminator": [
        107,
        112,
        18,
        38,
        56,
        173,
        60,
        128
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  116,
                  95,
                  112,
                  101,
                  114,
                  112,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.authority",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "passPotato",
      "discriminator": [
        190,
        50,
        114,
        47,
        91,
        160,
        191,
        201
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  116,
                  95,
                  112,
                  101,
                  114,
                  112,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.authority",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "toPlayerIdx",
          "type": "u8"
        }
      ]
    },
    {
      "name": "payoutWinner",
      "discriminator": [
        192,
        241,
        157,
        158,
        130,
        150,
        10,
        8
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  116,
                  95,
                  112,
                  101,
                  114,
                  112,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.authority",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "escrowUsdc",
          "writable": true
        },
        {
          "name": "winnerUsdc",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "escrowAuth"
        },
        {
          "name": "escrow"
        }
      ],
      "args": [
        {
          "name": "winnerIdx",
          "type": "u8"
        }
      ]
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer"
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "startRound",
      "discriminator": [
        144,
        144,
        43,
        7,
        193,
        42,
        217,
        215
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  116,
                  95,
                  112,
                  101,
                  114,
                  112,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.authority",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "game",
      "discriminator": [
        27,
        90,
        166,
        125,
        74,
        100,
        121,
        18
      ]
    }
  ],
  "events": [
    {
      "name": "explosionEvent",
      "discriminator": [
        56,
        85,
        220,
        147,
        179,
        167,
        40,
        61
      ]
    },
    {
      "name": "passEvent",
      "discriminator": [
        165,
        180,
        93,
        204,
        98,
        109,
        134,
        229
      ]
    },
    {
      "name": "roundStartEvent",
      "discriminator": [
        236,
        145,
        237,
        245,
        79,
        123,
        130,
        244
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "notWaiting",
      "msg": "Game is not in waiting state"
    },
    {
      "code": 6001,
      "name": "notActive",
      "msg": "Game is not in active state"
    },
    {
      "code": 6002,
      "name": "lobbyFull",
      "msg": "Game is full"
    },
    {
      "code": 6003,
      "name": "notHolder",
      "msg": "You are not the current holder"
    },
    {
      "code": 6004,
      "name": "timerNotExpired",
      "msg": "Timer has not expired yet"
    },
    {
      "code": 6005,
      "name": "insufficientEscrow",
      "msg": "Insufficient escrow balance"
    },
    {
      "code": 6006,
      "name": "alreadyJoined",
      "msg": "Player already in game"
    },
    {
      "code": 6007,
      "name": "invalidPlayerIndex",
      "msg": "Invalid player index"
    },
    {
      "code": 6008,
      "name": "gameOver",
      "msg": "Game is over"
    },
    {
      "code": 6009,
      "name": "notEnoughPlayers",
      "msg": "Not enough players to start"
    },
    {
      "code": 6010,
      "name": "wrongStakeMode",
      "msg": "Wrong stake mode for this operation"
    }
  ],
  "types": [
    {
      "name": "explosionEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "holder",
            "type": "pubkey"
          },
          {
            "name": "holderIdx",
            "type": "u8"
          },
          {
            "name": "round",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "game",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "gameId",
            "type": "u64"
          },
          {
            "name": "players",
            "type": {
              "vec": {
                "defined": {
                  "name": "player"
                }
              }
            }
          },
          {
            "name": "state",
            "type": {
              "defined": {
                "name": "gameState"
              }
            }
          },
          {
            "name": "config",
            "type": {
              "defined": {
                "name": "gameConfig"
              }
            }
          },
          {
            "name": "currentHolder",
            "type": "u8"
          },
          {
            "name": "round",
            "type": "u8"
          },
          {
            "name": "timerDeadline",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "gameConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameId",
            "type": "u64"
          },
          {
            "name": "maxPlayers",
            "type": "u8"
          },
          {
            "name": "totalRounds",
            "type": "u8"
          },
          {
            "name": "stakeMode",
            "type": {
              "defined": {
                "name": "stakeMode"
              }
            }
          },
          {
            "name": "buyInAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "gameState",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "waiting"
          },
          {
            "name": "active"
          },
          {
            "name": "exploded"
          },
          {
            "name": "finished"
          }
        ]
      }
    },
    {
      "name": "passEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "from",
            "type": "pubkey"
          },
          {
            "name": "to",
            "type": "pubkey"
          },
          {
            "name": "remainingSeconds",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "player",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "score",
            "type": "i32"
          },
          {
            "name": "passesMade",
            "type": "u32"
          },
          {
            "name": "roundsSurvived",
            "type": "u32"
          },
          {
            "name": "liquidationsCaused",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "roundStartEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "round",
            "type": "u8"
          },
          {
            "name": "holderIdx",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "stakeMode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "free"
          },
          {
            "name": "buyIn"
          }
        ]
      }
    }
  ]
};
