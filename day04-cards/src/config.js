// Shared constants for the card-game collection.

export const SUITS = [
  { s: '♠', red: false },
  { s: '♥', red: true },
  { s: '♦', red: true },
  { s: '♣', red: false },
];

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Blackjack point value of a rank (Ace handled specially by the hand logic).
export function rankValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

// Blackjack settings.
export const START_CHIPS = 1000;
export const NUM_DECKS = 4;
export const DEALER_STANDS_ON = 17;
export const BLACKJACK_PAYOUT = 1.5; // 3:2
