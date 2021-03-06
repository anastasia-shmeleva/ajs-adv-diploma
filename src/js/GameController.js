/* eslint-disable array-callback-return */
/* eslint-disable consistent-return */
/* eslint-disable no-restricted-syntax */
import themes from './themes';
import {
  Bowman, Swordsman, Magician, Vampire, Undead, Daemon,
} from './Players';
import { playerTeam, computerTeam } from './Team';
import { generateTeam } from './generators';
import GameState from './GameState';
import GamePlay from './GamePlay';
import cursors from './cursors';

export default class GameController {
  constructor(gamePlay, stateService) {
    this.gamePlay = gamePlay;
    this.stateService = stateService;
    this.selectedPlayer = undefined; // выбранный персонаж
    this.selectedIndex = null; // индекс выбранной ячейки
  }

  init() {
    // TODO: add event listeners to gamePlay events
    // TODO: load saved stated from stateService
    this.themeSet();
    this.teamSet();

    this.gamePlay.addCellEnterListener(this.onCellEnter.bind(this));
    this.gamePlay.addCellLeaveListener(this.onCellLeave.bind(this));
    this.gamePlay.addCellClickListener(this.onCellClick.bind(this));

    this.gamePlay.addNewGameListener(this.onNewGameClick.bind(this));
    this.gamePlay.addSaveGameListener(this.onSaveGameClick.bind(this));
    this.gamePlay.addLoadGameListener(this.onLoadGameClick.bind(this));

    GameState.from({
      playerTeam,
      computerTeam,
      level: 0,
      score: 0,
      maxScore: 0,
    });
  }

  checkGameState() {
    if (playerTeam.team.length === 0) {
      GamePlay.showMessage('Game over');
    }
    if (computerTeam.team.length === 0) {
      GameState.level += 1;
      GameState.score = playerTeam.team.reduce((sum, player) => sum + player.character.health, GameState.score);
      if (GameState.maxScore < GameState.score) {
        GameState.maxScore = GameState.score;
      }
      GameController.levelUp();
      this.themeSet(GameState.level);
      this.teamSet(GameState.level);
      if (GameState.level >= 4) {
        GamePlay.showMessage('You win!');
      }
    }
  }

  themeSet(level) {
    switch (level) {
      default:
        this.gamePlay.drawUi(themes.prairie);
        break;

      case 1:
        this.gamePlay.drawUi(themes.desert);
        break;

      case 2:
        this.gamePlay.drawUi(themes.arctic);
        break;

      case 3:
        this.gamePlay.drawUi(themes.mountain);
        break;
    }
  }

  teamSet(level) {
    switch (level) {
      default:
        generateTeam([Bowman, Swordsman], 1, 2, playerTeam);
        generateTeam([Vampire, Undead, Daemon], 1, 2, computerTeam);
        this.gamePlay.redrawPositions(playerTeam.team.concat(computerTeam.team));
        break;

      case 1:
        generateTeam([Bowman, Swordsman, Magician], 1, 1, playerTeam);
        generateTeam([Vampire, Undead, Daemon], 2, playerTeam.team.length, computerTeam);
        this.gamePlay.redrawPositions(playerTeam.team.concat(computerTeam.team));
        break;

      case 2:
        generateTeam([Bowman, Swordsman, Magician], 2, 1, playerTeam);
        generateTeam([Vampire, Undead, Daemon], 3, playerTeam.team.length, computerTeam);
        this.gamePlay.redrawPositions(playerTeam.team.concat(computerTeam.team));
        break;

      case 3:
        generateTeam([Bowman, Swordsman, Magician], 3, 1, playerTeam);
        generateTeam([Vampire, Undead, Daemon], 4, playerTeam.team.length, computerTeam);
        this.gamePlay.redrawPositions(playerTeam.team.concat(computerTeam.team));
        break;
    }
  }

  onNewGameClick() {
    GameState.score = 0;
    GameState.level = 0;
    playerTeam.team = [];
    computerTeam.team = [];
    this.themeSet();
    this.teamSet();
  }

  onSaveGameClick() {
    const state = {
      playerTeam: GameState.playerTeam,
      computerTeam: GameState.computerTeam,
      level: GameState.level,
      score: GameState.score,
      maxScore: GameState.maxScore,
    };
    this.stateService.save(state);
    GamePlay.showMessage('Game saved');
  }

  onLoadGameClick() {
    const load = this.stateService.load();
    playerTeam.team = load.playerTeam.team;
    computerTeam.team = load.computerTeam.team;
    this.themeSet(load.level);
    this.gamePlay.redrawPositions(load.playerTeam.team.concat(load.computerTeam.team));
  }

  onCellClick(index) {
    // TODO: react to click
    const character = this.gamePlay.cells[index].querySelector('.character');

    if (character !== null) {
      if (character.classList.contains('bowman') || character.classList.contains('swordsman') || character.classList.contains('magician')) {
        if (this.gamePlay.cells[index].classList.contains('selected-yellow')) { // снятие выбора с выбранной ячейки
          this.gamePlay.deselectCell(index);
          this.selectedIndex = null;
          this.selectedPlayer = undefined;
        } else { // задание выбранной ячейки и очистка предыдущих
          this.gamePlay.selectCell(index);
          if (this.selectedIndex !== undefined && this.selectedIndex !== null) {
            this.gamePlay.deselectCell(this.selectedIndex);
          }
          this.selectedIndex = index;
          this.selectedPlayer = playerTeam.team.find((element) => element.position === index);
        }
      } else if (this.selectedPlayer === undefined) {
        GamePlay.showError('Pay attention! This is not your character');
      } else if (this.gamePlay.boardEl.style.cursor === cursors.notallowed) {
        GamePlay.showError('Pay attention! This character is too far to attack!');
      } else { // атака
        const target = computerTeam.team.find((element) => element.position === index);
        if (this.gamePlay.getPossibleMove(this.selectedIndex, this.selectedPlayer.character.attackRadius).includes(index)) {
          this.attack(index, this.selectedPlayer, target);
          this.gamePlay.deselectCell(index);
        }
        setTimeout(() => {
          this.computerAction();
          this.checkGameState();
        }, 800);
      }
    } else if (this.selectedPlayer !== undefined && this.gamePlay.getPossibleMove(this.selectedIndex, this.selectedPlayer.character.distance).includes(index)) { // перемещение
      this.gamePlay.deselectCell(this.selectedIndex);
      this.selectedIndex = null;
      this.selectedPlayer.position = index;
      this.gamePlay.redrawPositions(playerTeam.team.concat(computerTeam.team));
      this.selectedPlayer = undefined;
      setTimeout(() => {
        this.computerAction();
      }, 800);
    }
  }

  onCellEnter(index) {
    // TODO: react to mouse enter
    const character = this.gamePlay.cells[index].querySelector('.character');
    const focusChar = playerTeam.team.find((element) => element.position === index);
    const focusCompetitor = computerTeam.team.find((element) => element.position === index);

    // отрисовка подсказок
    if (character !== null) {
      if (focusChar === undefined) {
        this.gamePlay.setCursor('not-allowed');
        this.gamePlay.showCellTooltip(`🎖 ${focusCompetitor.character.level} ⚔ ${focusCompetitor.character.attack} 🛡 ${focusCompetitor.character.defence} ❤ ${focusCompetitor.character.health}`, index);
      }
      if (focusCompetitor === undefined) {
        this.gamePlay.setCursor('pointer');
        this.gamePlay.showCellTooltip(`🎖 ${focusChar.character.level} ⚔ ${focusChar.character.attack} 🛡 ${focusChar.character.defence} ❤ ${focusChar.character.health}`, index);
      }
    }

    // отрисовка возможности хода
    if (!character && this.selectedPlayer !== undefined) {
      const { distance } = this.selectedPlayer.character;
      const possibleMove = this.gamePlay.getPossibleMove(this.selectedIndex, distance);
      for (const move of possibleMove) {
        if (index === move) {
          this.gamePlay.selectCell(index, 'green');
        }
      }
    }

    // отрисовка возможности атаки
    if (this.selectedPlayer !== undefined && character !== null && focusCompetitor) {
      const { attackRadius } = this.selectedPlayer.character;
      const possibleMove = this.gamePlay.getPossibleMove(this.selectedIndex, attackRadius);
      for (const move of possibleMove) {
        if (index === move) {
          this.gamePlay.selectCell(index, 'red');
          this.gamePlay.setCursor('crosshair');
        }
      }
    }
  }

  onCellLeave(index) {
    // TODO: react to mouse leave
    this.gamePlay.setCursor('auto');
    this.gamePlay.hideCellTooltip(index);
    // снимает все выделения кроме выбранного персонажа
    if (!this.gamePlay.cells[index].classList.contains('selected-yellow')) {
      this.gamePlay.deselectCell(index);
    }
  }

  async attack(index, player, target) {
    const damage = Math.max(player.character.attack - target.character.defence, player.character.attack * 0.1);
    target.character.health -= damage;
    if (target.character.health <= 0) {
      target.character.health = 0;
      computerTeam.team = computerTeam.team.filter((element) => element.position !== index);
      playerTeam.team = playerTeam.team.filter((element) => element.position !== index);
    }
    if (this.selectedIndex !== null) this.gamePlay.deselectCell(this.selectedIndex);
    this.selectedPlayer = undefined;
    this.selectedIndex = null;
    this.gamePlay.showDamage(index, damage).then(() => {
      this.checkGameState();
      this.gamePlay.redrawPositions(playerTeam.team.concat(computerTeam.team));
    });
  }

  async computerAction() {
    let rivalsPairs = computerTeam.team.map((enemyChar) => {
      const target = playerTeam.team.reduce((acc, userChar) => {
        const attackRange = this.gamePlay.getPossibleMove(enemyChar.position, enemyChar.character.attackRadius);
        if (attackRange.includes(userChar.position)) {
          acc = userChar;
          return acc;
        }
      });
      return [
        enemyChar,
        target,
      ];
    });

    rivalsPairs = rivalsPairs.filter((pair) => !pair.includes(undefined));

    if (rivalsPairs.length !== 0) {
      // attack
      if (rivalsPairs.length > 1) {
        rivalsPairs.sort((a, b) => {
          const damageA = Math.max(
            a[0].character.attack - a[1].character.defence,
            a[0].character.attack * 0.1,
          );
          const damageB = Math.max(
            b[0].character.attack - b[1].character.defence,
            b[0].character.attack * 0.1,
          );
          let value = 0;
          if (damageA > damageB) {
            value = -1;
          }
          return value;
        });
      }

      [[this.selectedCharacter, this.chosenCharacter]] = rivalsPairs;
      this.attack(this.chosenCharacter.position, this.selectedCharacter, this.chosenCharacter);
    } else { // moving
      const occupPositions = [];
      playerTeam.team.forEach((element) => occupPositions.push(element.position));
      computerTeam.team.forEach((element) => occupPositions.push(element.position));

      const activePlayer = computerTeam.team[
        Math.floor(Math.random() * computerTeam.team.length)
      ];

      const moveRange = this.gamePlay.getPossibleMove(activePlayer.position, activePlayer.character.distance);
      do {
        activePlayer.position = moveRange[Math.floor(Math.random() * moveRange.length)];
      } while (occupPositions.includes(activePlayer.position));
      this.gamePlay.redrawPositions(playerTeam.team.concat(computerTeam.team));
    }
  }

  static levelUp() {
    playerTeam.team.forEach((player) => {
      player.character.attack = Math.max(player.character.attack, (player.character.attack * (1.8 - player.character.health)) / 100);
      player.character.level += 1;
      player.character.health += 80;
      if (player.character.health >= 100) {
        player.character.health = 100;
      }
    });
  }
}
