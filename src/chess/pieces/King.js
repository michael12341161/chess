import { PIECES } from '../../utils/constants.js';
import { Queen } from './Queen.js';

export const King = {
  type: PIECES.KING,
  value: 20000,
  directions: Queen.directions,
};
