import { STORAGE_KEYS } from '../utils/constants.js';
import { uid } from '../utils/helpers.js';

const defaultHistoryIds = new Set(['autosave-local', 'autosave-ai']);

function removeDefaultHistory(games) {
  if (!Array.isArray(games)) return [];
  return games.filter((game) => game && !game.autoSaved && !defaultHistoryIds.has(game.id));
}

function readSavedGames() {
  try {
    const savedGames = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED_GAMES) ?? '[]');
    const userSavedGames = removeDefaultHistory(savedGames);
    if (Array.isArray(savedGames) && userSavedGames.length !== savedGames.length) {
      writeSavedGames(userSavedGames);
    }
    return userSavedGames;
  } catch {
    return [];
  }
}

function writeSavedGames(games) {
  localStorage.setItem(STORAGE_KEYS.SAVED_GAMES, JSON.stringify(games));
}

export function listLocalGames() {
  return readSavedGames().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function saveLocalGame(state, metadata = {}) {
  if (metadata.autoSaved) return null;

  const games = readSavedGames();
  const id = metadata.id ?? uid('game');
  const record = {
    id,
    title: metadata.title ?? `Game ${new Date().toLocaleString()}`,
    mode: metadata.mode ?? 'local',
    state,
    fen: metadata.fen,
    pgn: metadata.pgn,
    result: state.result,
    resultReason: state.resultReason,
    updatedAt: new Date().toISOString(),
    createdAt: metadata.createdAt ?? new Date().toISOString(),
  };
  writeSavedGames([record, ...games.filter((game) => game.id !== id)].slice(0, 50));
  return record;
}

export function loadLocalGame(id) {
  return readSavedGames().find((game) => game.id === id) ?? null;
}

export function deleteLocalGame(id) {
  writeSavedGames(readSavedGames().filter((game) => game.id !== id));
}
