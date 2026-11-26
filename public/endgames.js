// Endgame training positions for kids (3 levels).
// Modes: 'play' (play vs Stockfish), 'quiz' (answer without moving first, then optionally play out).
export const ENDGAMES = [
  // ---------------- Level 1 ----------------
  {
    id: 'l1_two_pawns', level: 1, mode: 'play', side: 'w', goal: 'win',
    fen: '4k3/8/8/4P3/4KP2/8/8/8 w - - 0 1',
    de: {
      title: '2 Bauern & Könige',
      task: 'Führe einen Bauern zur Umwandlung und gewinne gegen den König!',
      hint: 'Bringe deinen König nach vorne und unterstütze den Freibauern.',
    },
    en: {
      title: '2 Pawns & Kings',
      task: 'Promote one of your pawns and win against the lone king!',
      hint: 'Bring your king forward to support the passed pawn.',
    },
  },
  {
    id: 'l1_queen_mate', level: 1, mode: 'play', side: 'w', goal: 'mate',
    fen: '8/8/8/4k3/8/2Q5/4K3/8 w - - 0 1',
    de: {
      title: 'Matt mit der Dame',
      task: 'Setze den schwarzen König mit König und Dame matt!',
      hint: 'Dränge den König an den Rand (aufpassen auf Patt!) und hole deinen König dazu.',
    },
    en: {
      title: 'Mating with a Queen',
      task: 'Checkmate the black king with your king and queen!',
      hint: 'Push the king to the edge (watch out for stalemate!) and bring your king close.',
    },
  },
  {
    id: 'l1_rook_mate', level: 1, mode: 'play', side: 'w', goal: 'mate',
    fen: '8/8/3k4/8/3K4/8/8/R7 w - - 0 1',
    de: {
      title: 'Matt mit dem Turm',
      task: 'Setze den schwarzen König mit König und Turm matt!',
      hint: 'Schneide dem König Reihen ab und dränge ihn mit deinem König an den Rand.',
    },
    en: {
      title: 'Mating with a Rook',
      task: 'Checkmate the black king with your king and rook!',
      hint: 'Cut the king off along ranks or files and use your king to drive him to the edge.',
    },
  },

  // ---------------- Level 2 ----------------
  {
    id: 'l2_square', level: 2, mode: 'quiz', side: 'w', answer: 'win',
    fen: '8/8/8/8/P7/8/6k1/4K3 w - - 0 1',
    de: {
      title: 'Quadratregel (außerhalb des Quadrats)',
      task: 'Weiß ist am Zug. Gewinnt Weiß oder hält Schwarz Remis? Überlege ohne zu ziehen!',
      explain: 'Weiß gewinnt! Das Quadrat des Bauern a4 reicht bis e4–e8. Der schwarze König auf g2 steht außerhalb – nach 1. a5 kann er den Bauern nicht mehr einholen.',
    },
    en: {
      title: 'Rule of the Square (Outside the Square)',
      task: 'White to move. Does White win or is it a draw? Figure it out without moving!',
      explain: 'White wins! The pawn on a4 creates a square up to e4–e8. Black’s king on g2 is outside the square, so after 1. a5 Black cannot catch it.',
    },
  },
  {
    id: 'l2_opposition', level: 2, mode: 'quiz', side: 'w', answer: 'draw',
    fen: '4k3/8/8/4K3/4P3/8/8/8 w - - 0 1',
    altFen: '4k3/8/8/4K3/4P3/8/8/8 b - - 0 1',
    altAnswer: 'win',
    de: {
      title: 'König vor dem Bauern & Opposition',
      task: 'Wer gewinnt, je nachdem wer am Zug ist? Wechsle zwischen Weiß und Schwarz am Zug und entscheide ohne zu ziehen!',
      explain: 'Bei Weiß am Zug ist es Remis (nach 1. Kd6 Kd8 hält Schwarz die Opposition). Bei Schwarz am Zug muss Schwarz weichen (1… Kd7 2. Kf6!) und Weiß gewinnt!',
    },
    en: {
      title: 'King in front of Pawn & Opposition',
      task: 'Who wins depending on who starts? Switch White/Black to move and decide without moving!',
      explain: 'With White to move it is a draw (after 1. Kd6 Kd8 Black keeps the opposition). With Black to move Black must give way (1… Kd7 2. Kf6!) and White wins!',
    },
  },
  {
    id: 'l2_h_pawn', level: 2, mode: 'quiz', side: 'w', answer: 'draw',
    fen: '7k/8/6K1/7P/8/8/8/8 w - - 0 1',
    de: {
      title: 'König auf h8 & h-Bauer',
      task: 'Weiß ist am Zug. Ist diese Stellung gewonnen oder Remis? Überlege ohne zu ziehen!',
      explain: 'Remis! Schwarz pendelt einfach zwischen h8 und g8. Weiß kann den schwarzen König niemals aus der Ecke vertreiben, ohne Patt zu setzen.',
    },
    en: {
      title: 'King on h8 & h-Pawn',
      task: 'White to move. Is this position won or drawn? Figure it out without moving!',
      explain: 'Draw! Black simply shuttles between h8 and g8. White can never force the black king out of the corner without stalemating him.',
    },
  },
  {
    id: 'l2_knight_vs_king', level: 2, mode: 'play', side: 'w', goal: 'draw',
    fen: '8/K7/8/8/8/1k6/1N2p3/8 w - - 0 1',
    de: {
      title: 'Springer gegen König (+ e2-Bauer)',
      task: 'Weiß (Ka7, Sb2) gegen Schwarz (Kb3, Bauer e2). Halte das Remis und stoppe den Bauern!',
      hint: 'Ziehe 1. Sd3! Der Springer verlässt das angegriffene Feld und kontrolliert sofort e1.',
    },
    en: {
      title: 'Knight vs King (+ e2 Pawn)',
      task: 'White (Ka7, Nb2) vs Black (Kb3, e2 pawn). Stop the pawn and hold the draw!',
      hint: 'Play 1. Nd3! The knight escapes the attack and immediately controls e1.',
    },
  },

  // ---------------- Level 3 ----------------
  {
    id: 'l3_bp_right_corner', level: 3, mode: 'play', side: 'w', goal: 'win',
    fen: '7k/8/5K2/7P/8/2B5/8/8 w - - 0 1',
    de: {
      title: 'Läufer & Randbauer: Richtige Ecke',
      task: 'Weiß hat einen Läufer, der das Umwandlungsfeld h8 kontrolliert (schwarzfeldriger Läufer). Gewinne!',
      hint: 'Vertreibe den schwarzen König mit Läuferschachs und König aus der Ecke h8 und wandle den Bauern um.',
    },
    en: {
      title: 'Bishop & Rook-Pawn: The Right Corner',
      task: 'White’s bishop controls the promotion square h8 (dark-squared bishop). Win the game!',
      hint: 'Use your king and dark-squared bishop to drive Black’s king out of h8 and promote the h-pawn.',
    },
  },
  {
    id: 'l3_bp_wrong_corner', level: 3, mode: 'play', side: 'b', goal: 'draw',
    fen: '7k/8/5K2/7P/8/3B4/8/8 b - - 0 1',
    de: {
      title: 'Läufer & Randbauer: Falsche Ecke',
      task: 'Du spielst Schwarz. Der weiße Läufer ist weißfeldrig und kontrolliert h8 nicht! Halte Remis.',
      hint: 'Bleibe mit deinem König in der Ecke (h8/g8) – Weiß kann dich nicht vertreiben, ohne Patt zu setzen.',
    },
    en: {
      title: 'Bishop & Rook-Pawn: The Wrong Corner',
      task: 'You play Black. White’s light-squared bishop does NOT control h8! Hold the draw.',
      hint: 'Keep your king in the h8/g8 corner — White cannot force you out without stalemating.',
    },
  },
  {
    id: 'l3_q_vs_7th_pawn', level: 3, mode: 'play', side: 'w', goal: 'win',
    fen: '8/8/8/3Q4/8/2K5/4p3/3k4 w - - 0 1',
    de: {
      title: 'Dame gegen Bauer auf der 7. Reihe',
      task: 'Gewinne mit der Dame gegen den e2-Bauern!',
      hint: 'Gib Schachs, um den schwarzen König vor seinen eigenen Bauern (e1) zu zwingen – dann hat dein König Zeit näherzukommen.',
    },
    en: {
      title: 'Queen vs 7th-Rank Pawn',
      task: 'Win with your queen against the e2 pawn!',
      hint: 'Use checks to force Black’s king in front of the pawn (e1), giving your king a tempo to approach.',
    },
  },
  {
    id: 'l3_q_vs_7th_bpawn', level: 3, mode: 'play', side: 'w', goal: 'draw',
    fen: '8/8/8/3Q4/8/1K6/5p2/4k3 w - - 0 1',
    de: {
      title: 'Dame gegen Läuferbauer (7. Reihe)',
      task: 'Spiele gegen den f2-Bauern! Finde heraus, ob Weiß gewinnt oder ob der Patt-Trick zum Remis führt.',
      hint: 'Beim Läuferbauern (c/f) kann sich der schwarze König in die Ecke verkrümeln – schlägt die Dame auf f2, ist es Patt!',
    },
    en: {
      title: 'Queen vs 7th-Rank Bishop’s Pawn',
      task: 'Play against the f2 pawn! See why the bishop’s pawn stalemate trick holds a draw.',
      hint: 'With a bishop’s pawn (c or f), Black’s king hides in the corner – capturing the pawn gives stalemate!',
    },
  },
];
