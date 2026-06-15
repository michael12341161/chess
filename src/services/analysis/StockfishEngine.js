const ENGINE_SCRIPT = '/stockfish/stockfish-18-lite-single.js';
const ENGINE_NAME = 'Stockfish 18 Lite';

function parseScore(line) {
  const mateMatch = line.match(/\bscore mate (-?\d+)/);
  if (mateMatch) {
    const mate = Number(mateMatch[1]);
    return {
      mate,
      cp: mate > 0 ? 100000 - mate : -100000 - mate,
    };
  }

  const cpMatch = line.match(/\bscore cp (-?\d+)/);
  if (!cpMatch) return null;
  return { cp: Number(cpMatch[1]), mate: null };
}

function parsePv(line) {
  const pvIndex = line.indexOf(' pv ');
  if (pvIndex === -1) return [];
  return line.slice(pvIndex + 4).trim().split(/\s+/).filter(Boolean);
}

function isWorkerSupported() {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

export class StockfishEngine {
  constructor({ timeoutMs = 2500 } = {}) {
    if (!isWorkerSupported()) {
      throw new Error('Stockfish worker is not available in this environment.');
    }

    this.timeoutMs = timeoutMs;
    this.worker = new Worker(ENGINE_SCRIPT);
    this.listeners = new Set();
    this.worker.onmessage = (event) => {
      const message = String(event.data ?? '');
      this.listeners.forEach((listener) => listener(message));
    };
  }

  send(command) {
    this.worker.postMessage(command);
  }

  waitFor(predicate, timeoutMs = this.timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error('Stockfish response timed out.'));
      }, timeoutMs);

      const listener = (message) => {
        if (!predicate(message)) return;
        window.clearTimeout(timer);
        this.listeners.delete(listener);
        resolve(message);
      };

      this.listeners.add(listener);
    });
  }

  async init() {
    this.send('uci');
    await this.waitFor((message) => message === 'uciok');
    this.send('setoption name UCI_LimitStrength value false');
    this.send('setoption name Skill Level value 20');
    this.send('setoption name UCI_ShowWDL value true');
    this.send('isready');
    await this.waitFor((message) => message === 'readyok');
    this.send('ucinewgame');
  }

  async analyzeFen(fen, { movetime = 90 } = {}) {
    let latestScore = null;
    let latestPv = [];

    const listener = (message) => {
      if (!message.startsWith('info ')) return;
      const score = parseScore(message);
      if (score) latestScore = score;
      const pv = parsePv(message);
      if (pv.length) latestPv = pv;
    };

    this.listeners.add(listener);
    this.send(`position fen ${fen}`);
    this.send(`go movetime ${movetime}`);

    try {
      const bestMoveLine = await this.waitFor((message) => message.startsWith('bestmove '), this.timeoutMs + movetime);
      const [, bestMove] = bestMoveLine.split(/\s+/);
      return {
        engine: ENGINE_NAME,
        scoreCp: latestScore?.cp ?? 0,
        mate: latestScore?.mate ?? null,
        bestMove: bestMove && bestMove !== '(none)' ? bestMove : null,
        pv: latestPv,
      };
    } finally {
      this.listeners.delete(listener);
    }
  }

  dispose() {
    try {
      this.send('quit');
    } catch {
      // The worker may already be gone.
    }
    this.worker.terminate();
  }
}

export function stockfishAvailable() {
  return isWorkerSupported();
}
