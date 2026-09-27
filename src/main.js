import './style.css';
import { Game } from './game.js';

const game = new Game(document.getElementById('c'));
window.game = game; // handy for poking at things from the console
