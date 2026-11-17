const D = {
  de: {
    app: 'Schach-Training', login: 'Anmelden', register: 'Registrieren', logout: 'Abmelden',
    username: 'Benutzername', email: 'E-Mail', login_id: 'Benutzername oder E-Mail', password: 'Passwort (min. 8 Zeichen)',
    have_account: 'Schon ein Konto? Anmelden', no_account: 'Noch kein Konto? Registrieren',
    nav_home: 'Start', nav_openings: 'Eröffnungen', nav_train: 'Training', nav_mine: 'Meine Notizen',
    err_bad_credentials: 'Anmeldung fehlgeschlagen.', err_user_exists: 'Benutzername oder E-Mail existiert schon.',
    err_invalid_username: 'Benutzername: 3–32 Zeichen (Buchstaben, Zahlen, . _ -).', err_invalid_email: 'Ungültige E-Mail.',
    err_weak_password: 'Passwort zu kurz (min. 8 Zeichen).', err_generic: 'Fehler: ',
    welcome: 'Hallo', stats_games: 'Trainierte Partien', stats_acc: 'Zug richtig im 1. Versuch', stats_avail: 'Verfügbare Partien (deine Eröffnungen)', stats_annot: 'Kommentierte Partien',
    start_training: 'Training starten', pick_openings_first: 'Wähle zuerst Eröffnungen aus.',
    openings_title: 'Eröffnungen wählen', search: 'Suchen (ECO oder Name) …', only_with_games: 'Nur Eröffnungen mit Partien', select_visible: 'Sichtbare wählen', clear_all: 'Alle abwählen',
    save: 'Speichern', saved: 'Gespeichert ✓', games: 'Partien', selected_n: 'ausgewählt',
    filter_title: 'Filter (Stärkeunterschied)', min_gap: 'Min. Elo-Differenz', min_rating: 'Min. Elo des Stärkeren',
    train_side: 'Du spielst', white: 'Weiß', black: 'Schwarz', your_move: 'Dein Zug …', opp_move: 'Gegner zieht …',
    wrong: 'Leider falsch.', tries_left: 'Versuche übrig', revealed: 'Gespielt wurde:', correct: 'Richtig!',
    hint: 'Tipp', this_opening: '(genau diese Eröffnung, ohne Varianten)', new_game: 'Neue Partie', confirm_new: 'Aktuelle Partie abbrechen und eine neue Partie starten?', expand_all: 'Alle aufklappen', collapse_all: 'Alle zuklappen', eco_A: 'Flank- & unregelmäßige Eröffnungen', eco_B: 'Halboffene Spiele (Sizilianisch, Caro-Kann, …)', eco_C: 'Offene Spiele & Französisch', eco_D: 'Geschlossene & halbgeschlossene Spiele', eco_E: 'Indische Verteidigungen', show_comments: 'Kommentare anzeigen', fullscreen: 'Vollbild', google_login: 'Mit Google anmelden', google_link: 'Konto mit Google verknüpfen', note_start: 'Notiz zur Grundstellung', note_after: 'Notiz zur Stellung nach',
    err_oauth_failed: 'Google-Anmeldung fehlgeschlagen.', err_oauth_unconfigured: 'Google-Anmeldung ist nicht eingerichtet.', err_email_taken_password: 'Diese E-Mail gehört zu einem Passwort-Konto. Bitte mit Passwort anmelden und dort Google verknüpfen.', err_google_taken: 'Dieses Google-Konto ist schon mit einem anderen Benutzer verknüpft.', book_played: 'Eröffnung bereits gespielt:', skip: 'Partie überspringen', next_game: 'Nächste Partie', review: 'Analysieren / Kommentieren',
    game_over: 'Partie beendet', score: 'Richtig im 1. Versuch', result: 'Ergebnis', no_games: 'Keine passende Partie gefunden. Wähle andere Eröffnungen oder lockere den Filter.',
    repeat_games: 'Bereits gespielte Partien wiederholen', loading: 'Lädt …', moves: 'Züge',
    annotate_title: 'Partie analysieren', comment: 'Kommentar zum gewählten Zug', delete_move: 'Zug/Variante löschen', make_main: 'Zur Hauptvariante machen',
    export_game: 'PGN exportieren', export_all: 'Alle Notizen exportieren (PGN)', start_pos: 'Grundstellung',
    mine_title: 'Meine kommentierten Partien', none_yet: 'Noch keine.', open: 'Öffnen',
  },
  en: {
    app: 'Chess Training', login: 'Log in', register: 'Register', logout: 'Log out',
    username: 'Username', email: 'Email', login_id: 'Username or email', password: 'Password (min. 8 characters)',
    have_account: 'Already have an account? Log in', no_account: 'No account yet? Register',
    nav_home: 'Home', nav_openings: 'Openings', nav_train: 'Training', nav_mine: 'My annotations',
    err_bad_credentials: 'Login failed.', err_user_exists: 'Username or email already exists.',
    err_invalid_username: 'Username: 3–32 characters (letters, digits, . _ -).', err_invalid_email: 'Invalid email.',
    err_weak_password: 'Password too short (min. 8 characters).', err_generic: 'Error: ',
    welcome: 'Hello', stats_games: 'Games trained', stats_acc: 'Moves right on first try', stats_avail: 'Available games (your openings)', stats_annot: 'Annotated games',
    start_training: 'Start training', pick_openings_first: 'Pick some openings first.',
    openings_title: 'Choose openings', search: 'Search (ECO or name) …', only_with_games: 'Only openings with games', select_visible: 'Select visible', clear_all: 'Clear all',
    save: 'Save', saved: 'Saved ✓', games: 'games', selected_n: 'selected',
    filter_title: 'Filter (rating gap)', min_gap: 'Min. rating difference', min_rating: 'Min. rating of stronger player',
    train_side: 'You play', white: 'White', black: 'Black', your_move: 'Your move …', opp_move: 'Opponent is moving …',
    wrong: 'Sorry, wrong.', tries_left: 'tries left', revealed: 'Played in the game:', correct: 'Correct!',
    hint: 'Hint', this_opening: '(this opening itself, without variations)', new_game: 'New game', confirm_new: 'Abandon the current game and start a new one?', expand_all: 'Expand all', collapse_all: 'Collapse all', eco_A: 'Flank & irregular openings', eco_B: 'Semi-open games (Sicilian, Caro-Kann, …)', eco_C: 'Open games & French', eco_D: 'Closed & semi-closed games', eco_E: 'Indian defences', show_comments: 'Show comments', fullscreen: 'Fullscreen', google_login: 'Sign in with Google', google_link: 'Link account with Google', note_start: 'Note on the start position', note_after: 'Note on the position after',
    err_oauth_failed: 'Google sign-in failed.', err_oauth_unconfigured: 'Google sign-in is not configured.', err_email_taken_password: 'This email belongs to a password account. Please log in with your password and link Google there.', err_google_taken: 'This Google account is already linked to another user.', book_played: 'Opening already played:', skip: 'Skip game', next_game: 'Next game', review: 'Analyze / annotate',
    game_over: 'Game finished', score: 'Right on first try', result: 'Result', no_games: 'No matching game found. Pick other openings or relax the filter.',
    repeat_games: 'Repeat games already played', loading: 'Loading …', moves: 'moves',
    annotate_title: 'Analyze game', comment: 'Comment on selected move', delete_move: 'Delete move/variation', make_main: 'Make main line',
    export_game: 'Export PGN', export_all: 'Export all annotations (PGN)', start_pos: 'Start position',
    mine_title: 'My annotated games', none_yet: 'None yet.', open: 'Open',
  },
};

let lang = localStorage.getItem('lang') || ((navigator.language || 'de').slice(0, 2) === 'en' ? 'en' : 'de');

export const getLang = () => lang;
export function setLang(l) { lang = l === 'en' ? 'en' : 'de'; localStorage.setItem('lang', lang); }
export const t = (k) => D[lang][k] ?? D.de[k] ?? k;
