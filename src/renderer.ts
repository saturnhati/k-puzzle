import './index.css';
import svgContent from '../assets/jigsaw.svg?raw';

interface Idol {
  name: string;
  images: string[];
}

interface PuzzlePiece {
  id: number;
  currentX: number;
  currentY: number;
  correctX: number;
  correctY: number;
  isSnapped: boolean;
  element: HTMLElement;
}

interface Point {
  x: number;
  y: number;
}

function buildIdols(): Idol[] {
  const modules = import.meta.glob('../assets/images/*/*.{jpg,jpeg,png}', {
    eager: true,
    query: '?url',
    import: 'default'
  }) as Record<string, string>;

  const map = new Map<string, string[]>();
  for (const [path, url] of Object.entries(modules)) {
    if (path.toLowerCase().includes('cover')) continue;
    const match = path.match(/images\/([^/]+)\//);
    if (match) {
      const name = match[1];
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(url);
    }
  }
  return Array.from(map.entries())
    .map(([name, images]) => ({ name, images }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const idols = buildIdols();
const covers = buildCovers();

const mysteryCover = (() => {
  const m = import.meta.glob('../assets/images/cover.{jpg,jpeg,png}', {
    eager: true,
    query: '?url',
    import: 'default'
  }) as Record<string, string>;
  return Object.values(m)[0];
})();

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildCovers(): Map<string, string> {
  const modules = import.meta.glob('../assets/images/*/cover.{jpg,jpeg,png}', {
    eager: true,
    query: '?url',
    import: 'default'
  }) as Record<string, string>;

  const map = new Map<string, string>();
  for (const [path, url] of Object.entries(modules)) {
    const match = path.match(/images\/([^/]+)\//);
    if (match) map.set(match[1], url);
  }
  return map;
}

class JigsawPuzzle {
  private gridSize: number = 10;
  private pieceSize: number = 60;
  private overhang: number = 15;
  private elementSize: number = 90;
  private pieces: PuzzlePiece[] = [];
  private placed: number = 0;
  private timer: number = 0;
  private timerInterval: number | null = null;
  private currentImage: string = '';
  private isGameStarted: boolean = false;
  private draggedPiece: PuzzlePiece | null = null;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;
  private verticalCutLines: string[][] = [];
  private horizontalCutLines: string[][] = [];
  private pathsLoaded: boolean = false;

  constructor() {
    this.renderHomeScreen();
    this.initializeEventListeners();
  }

  private renderHomeScreen(): void {
    const grid = document.getElementById('puzzleGrid') as HTMLElement;
    grid.innerHTML = '';

    const randomCard = document.createElement('div');
    randomCard.className = 'puzzle-card random-card';
    const randomThumb = document.createElement('div');
    randomThumb.className = 'card-thumb';
    if (mysteryCover) {
      const img = document.createElement('img');
      img.src = mysteryCover;
      img.alt = 'Random';
      randomThumb.appendChild(img);
    } else {
      randomThumb.innerHTML = '<span class="random-icon">?</span>';
    }
    const randomLabel = document.createElement('span');
    randomLabel.className = 'card-label';
    randomLabel.textContent = '?? RANDOM ??';
    randomCard.appendChild(randomThumb);
    randomCard.appendChild(randomLabel);
    randomCard.addEventListener('click', () => this.selectRandomIdol());
    grid.appendChild(randomCard);

    idols.forEach(idol => {
      const card = document.createElement('div');
      card.className = 'puzzle-card idol-card';
      card.dataset.name = idol.name;

      const thumb = document.createElement('div');
      thumb.className = 'card-thumb idol-thumb';

      const cover = covers.get(idol.name);
      if (cover) {
        const img = document.createElement('img');
        img.src = cover;
        img.alt = idol.name;
        thumb.appendChild(img);
      } else {
        thumb.textContent = idol.name[0];
      }
      thumb.title = `${idol.name} (${idol.images.length} images)`;

      const label = document.createElement('span');
      label.className = 'card-label';
      label.textContent = idol.name;

      const count = document.createElement('span');
      count.className = 'card-count';
      count.textContent = `${idol.images.length} IMG`;

      card.appendChild(thumb);
      card.appendChild(label);
      card.appendChild(count);
      card.addEventListener('click', () => this.selectIdol(idol));

      grid.appendChild(card);
    });
  }

  private initializeEventListeners(): void {
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    const shuffleBtn = document.getElementById('shuffleBtn') as HTMLButtonElement;
    const backBtn = document.getElementById('backBtn') as HTMLButtonElement;
    const revealBtn = document.getElementById('revealBtn') as HTMLButtonElement;

    startBtn.addEventListener('click', () => this.startGame());
    shuffleBtn.addEventListener('click', () => this.shufflePieces());
    backBtn.addEventListener('click', () => this.goHome());
    revealBtn.addEventListener('click', () => this.toggleReveal());
  }

  private selectIdol(idol: Idol): void {
    this.currentImage = randomItem(idol.images);
    this.showGameScreen();
    this.startGame();
  }

  private selectRandomIdol(): void {
    const idol = randomItem(idols);
    this.currentImage = randomItem(idol.images);
    this.showGameScreen();
    this.startGame();
  }

  private showGameScreen(): void {
    document.getElementById('homeScreen')?.classList.add('hidden');
    document.getElementById('gameScreen')?.classList.remove('hidden');
    const revealBtn = document.getElementById('revealBtn') as HTMLButtonElement;
    revealBtn.textContent = 'REVEAL';
    revealBtn.classList.remove('revealed');
    const previewImg = document.getElementById('previewImage') as HTMLImageElement;
    previewImg.classList.add('hidden');
    previewImg.src = this.currentImage;
  }

  private toggleReveal(): void {
    const previewImg = document.getElementById('previewImage') as HTMLImageElement;
    const revealBtn = document.getElementById('revealBtn') as HTMLButtonElement;
    const isHidden = previewImg.classList.contains('hidden');
    if (isHidden) {
      previewImg.classList.remove('hidden');
      revealBtn.textContent = 'HIDE';
      revealBtn.classList.add('revealed');
    } else {
      previewImg.classList.add('hidden');
      revealBtn.textContent = 'REVEAL';
      revealBtn.classList.remove('revealed');
    }
    this.repositionUnsnapped();
  }

  private repositionUnsnapped(): void {
    const tray = document.getElementById('pieceTray') as HTMLElement;

    this.pieces.forEach(piece => {
      if (!piece.isSnapped) {
        const maxX = tray.clientWidth - this.elementSize;
        const maxY = tray.clientHeight - this.elementSize;

        piece.currentX = Math.random() * Math.max(0, maxX);
        piece.currentY = Math.random() * Math.max(0, maxY);
        piece.element.style.left = `${piece.currentX}px`;
        piece.element.style.top = `${piece.currentY}px`;

        if (piece.element.parentNode !== tray) {
          tray.appendChild(piece.element);
        }
      }
    });
  }

  private goHome(): void {
    this.isGameStarted = false;
    this.stopTimer();
    this.pieces = [];
    const workspace = document.getElementById('workspace') as HTMLElement;
    workspace.innerHTML = '';
    document.getElementById('gameScreen')?.classList.add('hidden');
    document.getElementById('homeScreen')?.classList.remove('hidden');
  }

  private startGame(): void {
    this.placed = 0;
    this.timer = 0;
    this.isGameStarted = true;
    this.updateStats();
    this.stopTimer();
    this.startTimer();

    if (!this.pathsLoaded) {
      this.loadAndParseSVG();
    }

    this.initializePuzzle();
    this.shufflePieces();
  }

  private loadAndParseSVG(): void {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const pathElements = svgDoc.querySelectorAll('path');

    const allCommands: string[][] = [];
    for (let i = 1; i < pathElements.length; i++) {
      const d = pathElements[i].getAttribute('d') || '';
      const raw = this.splitPathIntoCommands(d);
      const expanded = this.expandSCommands(raw);
      allCommands.push(expanded);
    }

    this.verticalCutLines = allCommands.slice(0, 9);
    this.horizontalCutLines = allCommands.slice(9, 18);
    this.pathsLoaded = true;
  }

  private expandSCommands(commands: string[]): string[] {
    const result: string[] = [];
    let prevCP: Point | null = null;
    let current: Point | null = null;

    for (const cmd of commands) {
      const t = cmd[0];
      const end = this.getCommandEndPoint(cmd);

      if (t === 'M') {
        current = end;
        prevCP = null;
        result.push(cmd);
      } else if (t === 'S') {
        const nums = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
        const cpx2 = nums[0], cpy2 = nums[1];
        const cpx1 = prevCP && current ? (2 * current.x - prevCP.x) : (current ? current.x : 0);
        const cpy1 = prevCP && current ? (2 * current.y - prevCP.y) : (current ? current.y : 0);
        result.push(`C ${this.formatPoint(cpx1, cpy1)} ${this.formatPoint(cpx2, cpy2)} ${this.formatPoint(end.x, end.y)}`);
        prevCP = { x: cpx2, y: cpy2 };
        current = end;
      } else if (t === 'C') {
        const nums = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
        prevCP = { x: nums[nums.length - 4], y: nums[nums.length - 3] };
        current = end;
        result.push(cmd);
      } else {
        if (t === 'L' || t === 'Q' || t === 'T') {
          current = end;
        }
        result.push(cmd);
      }
    }

    return result;
  }

  private splitPathIntoCommands(d: string): string[] {
    const commands: string[] = [];
    const regex = /([MLCSQTAZ])\s*([^MLCSQTAZ]*?)(?=[MLCSQTAZ]|$)/g;
    let match;
    while ((match = regex.exec(d)) !== null) {
      commands.push(match[1] + match[2].trim());
    }
    return commands;
  }

  private getCommandEndPoint(cmd: string): Point {
    const nums = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
    return { x: nums[nums.length - 2], y: nums[nums.length - 1] };
  }

  private formatPoint(x: number, y: number): string {
    return `${x.toFixed(4)} ${y.toFixed(4)}`;
  }

  private extractVerticalSegment(commands: string[], row: number): string {
    const startY = row * this.pieceSize;
    const endY = (row + 1) * this.pieceSize;
    const eps = 0.1;

    const segment: string[] = [];
    let cutX = 0;
    let collecting = false;

    for (const cmd of commands) {
      if (cmd[0] === 'M') {
        cutX = this.getCommandEndPoint(cmd).x;
        continue;
      }

      const end = this.getCommandEndPoint(cmd);

      if (!collecting) {
        if (end.y > startY + eps) {
          collecting = true;
          segment.push(`M ${this.formatPoint(cutX, startY)}`);
          segment.push(cmd);
        }
      } else {
        segment.push(cmd);
        if (end.y >= endY - eps) {
          break;
        }
      }
    }

    return segment.join(' ');
  }

  private extractHorizontalSegment(commands: string[], col: number): string {
    const startX = col * this.pieceSize;
    const endX = (col + 1) * this.pieceSize;
    const eps = 0.1;

    const segment: string[] = [];
    let cutY = 0;
    let collecting = false;

    for (const cmd of commands) {
      if (cmd[0] === 'M') {
        cutY = this.getCommandEndPoint(cmd).y;
        continue;
      }

      const end = this.getCommandEndPoint(cmd);

      if (!collecting) {
        if (end.x > startX + eps) {
          collecting = true;
          segment.push(`M ${this.formatPoint(startX, cutY)}`);
          segment.push(cmd);
        }
      } else {
        segment.push(cmd);
        if (end.x >= endX - eps) {
          break;
        }
      }
    }

    return segment.join(' ');
  }

  private reversePath(pathStr: string): string {
    if (!pathStr) return '';

    const commands = this.splitPathIntoCommands(pathStr);
    if (commands.length < 2) return pathStr;

    const expanded: string[] = [];
    let prevCP: Point | null = null;
    let current: Point = { x: 0, y: 0 };

    for (const cmd of commands) {
      const t = cmd[0];
      const end = this.getCommandEndPoint(cmd);

      if (t === 'M') {
        current = end;
        prevCP = null;
        expanded.push(cmd);
      } else if (t === 'S') {
        const nums = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
        const cpx2 = nums[0], cpy2 = nums[1];
        const cpx1 = prevCP ? (2 * current.x - prevCP.x) : current.x;
        const cpy1 = prevCP ? (2 * current.y - prevCP.y) : current.y;
        expanded.push(`C ${this.formatPoint(cpx1, cpy1)} ${this.formatPoint(cpx2, cpy2)} ${this.formatPoint(end.x, end.y)}`);
        prevCP = { x: cpx2, y: cpy2 };
        current = end;
      } else {
        expanded.push(cmd);
        if (t === 'C') {
          const nums = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
          prevCP = { x: nums[nums.length - 4], y: nums[nums.length - 3] };
        }
        current = end;
      }
    }

    if (expanded.length < 2) return pathStr;

    const reversed: string[] = [];
    const lastEnd = this.getCommandEndPoint(expanded[expanded.length - 1]);
    reversed.push(`M ${this.formatPoint(lastEnd.x, lastEnd.y)}`);

    for (let i = expanded.length - 1; i >= 1; i--) {
      const cmd = expanded[i];
      if (cmd[0] === 'C') {
        const nums = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
        const x1 = nums[0], y1 = nums[1], x2 = nums[2], y2 = nums[3], x = nums[4], y = nums[5];

        let prevEnd: Point;
        if (i > 1) {
          prevEnd = this.getCommandEndPoint(expanded[i - 1]);
        } else {
          prevEnd = this.getCommandEndPoint(expanded[0]);
        }
        reversed.push(`C ${this.formatPoint(x2, y2)} ${this.formatPoint(x1, y1)} ${this.formatPoint(prevEnd.x, prevEnd.y)}`);
      }
    }

    return reversed.join(' ');
  }

  private stripM(path: string): string {
    return path.replace(/^M\s+-?[\d.]+(?:\s+|\s*,\s*)-?[\d.]+/, '').trim();
  }

  private generatePieceClipPaths(): void {
    const S = this.pieceSize;
    const grid = this.gridSize;
    const container = document.getElementById('masks-container') as HTMLElement;
    container.innerHTML = '';

    for (let row = 0; row < grid; row++) {
      for (let col = 0; col < grid; col++) {
        const parts: string[] = [];

        if (row === 0) {
          parts.push(`M ${this.formatPoint(col * S, row * S)} L ${this.formatPoint((col + 1) * S, row * S)}`);
        } else {
          const cutCommands = this.horizontalCutLines[row - 1];
          if (cutCommands) {
            const seg = this.extractHorizontalSegment(cutCommands, col);
            parts.push(seg);
          }
        }

        if (col === grid - 1) {
          parts.push(`L ${this.formatPoint((col + 1) * S, (row + 1) * S)}`);
        } else {
          const cutCommands = this.verticalCutLines[col];
          if (cutCommands) {
            const seg = this.extractVerticalSegment(cutCommands, row);
            parts.push(this.stripM(seg));
          }
        }

        if (row === grid - 1) {
          parts.push(`L ${this.formatPoint(col * S, (row + 1) * S)}`);
        } else {
          const cutCommands = this.horizontalCutLines[row];
          if (cutCommands) {
            const seg = this.extractHorizontalSegment(cutCommands, col);
            const reversed = this.reversePath(seg);
            parts.push(this.stripM(reversed));
          }
        }

        if (col === 0) {
          parts.push(`L ${this.formatPoint(col * S, row * S)}`);
        } else {
          const cutCommands = this.verticalCutLines[col - 1];
          if (cutCommands) {
            const seg = this.extractVerticalSegment(cutCommands, row);
            const reversed = this.reversePath(seg);
            parts.push(this.stripM(reversed));
          }
        }

        const fullPath = parts.join(' ') + ' Z';
        const normalized = this.normalizePath(fullPath, col * S, row * S, this.elementSize, this.overhang);

        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.setAttribute('id', `clip-${row}-${col}`);
        clipPath.setAttribute('clipPathUnits', 'objectBoundingBox');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', normalized);
        clipPath.appendChild(path);
        container.appendChild(clipPath);
      }
    }
  }

  private normalizePath(pathData: string, originX: number, originY: number, elementSize: number, overhang: number): string {
    return pathData.replace(/([MLCSQTA])\s*((?:[\d.-]+[\s,]+)*[\d.-]+)/g, (_, cmd, rest) => {
      const nums = rest.trim().split(/[\s,]+/).map(Number);
      const transformed: number[] = [];
      for (let i = 0; i < nums.length; i += 2) {
        transformed.push((nums[i] - originX + overhang) / elementSize);
        transformed.push((nums[i + 1] - originY + overhang) / elementSize);
      }
      return cmd + ' ' + transformed.map(n => n.toFixed(6)).join(' ');
    }).replace(/Z/g, 'Z');
  }

  private initializePuzzle(): void {
    const workspace = document.getElementById('workspace') as HTMLElement;
    const tray = document.getElementById('pieceTray') as HTMLElement;
    workspace.innerHTML = '';

    this.generatePieceClipPaths();

    this.pieces = [];

    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        const pieceId = row * this.gridSize + col;
        const piece = this.createPiece(pieceId, row, col);
        this.pieces.push(piece);
        tray.appendChild(piece.element);
      }
    }
  }

  private createPiece(id: number, row: number, col: number): PuzzlePiece {
    const element = document.createElement('div');
    element.className = 'puzzle-piece';
    element.style.width = `${this.elementSize}px`;
    element.style.height = `${this.elementSize}px`;
    element.dataset.id = id.toString();

    const bgX = -(col * this.pieceSize) + this.overhang;
    const bgY = -(row * this.pieceSize) + this.overhang;

    element.style.backgroundImage = `url(${this.currentImage})`;
    element.style.backgroundPosition = `${bgX}px ${bgY}px`;
    element.style.backgroundSize = `${this.pieceSize * this.gridSize}px ${this.pieceSize * this.gridSize}px`;

    element.style.clipPath = `url(#clip-${row}-${col})`;
    element.style.webkitClipPath = `url(#clip-${row}-${col})`;

    element.addEventListener('mousedown', (e) => this.handleDragStart(e, id));
    element.addEventListener('touchstart', (e) => this.handleDragStart(e, id), { passive: false });

    const correctX = col * this.pieceSize - this.overhang;
    const correctY = row * this.pieceSize - this.overhang;

    return {
      id,
      currentX: 0,
      currentY: 0,
      correctX,
      correctY,
      isSnapped: false,
      element
    };
  }

  private handleDragStart(e: MouseEvent | TouchEvent, pieceId: number): void {
    if (!this.isGameStarted) return;
    e.preventDefault();

    const piece = this.pieces.find(p => p.id === pieceId);
    if (!piece || piece.isSnapped) return;

    const workspace = document.getElementById('workspace') as HTMLElement;

    if (piece.element.parentNode !== workspace) {
      const trayRect = piece.element.parentElement!.getBoundingClientRect();
      const wsRect = workspace.getBoundingClientRect();
      piece.currentX = trayRect.left - wsRect.left + piece.currentX;
      piece.currentY = trayRect.top - wsRect.top + piece.currentY;
      piece.element.style.left = `${piece.currentX}px`;
      piece.element.style.top = `${piece.currentY}px`;
      workspace.appendChild(piece.element);
    }

    this.draggedPiece = piece;

    const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
    const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;

    const rect = piece.element.getBoundingClientRect();
    this.dragOffsetX = clientX - rect.left;
    this.dragOffsetY = clientY - rect.top;

    piece.element.style.zIndex = '1000';

    const moveHandler = (moveEvent: MouseEvent | TouchEvent) => this.handleDragMove(moveEvent);
    const upHandler = (upEvent: MouseEvent | TouchEvent) => {
      this.handleDragEnd(upEvent);
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
      document.removeEventListener('touchmove', moveHandler);
      document.removeEventListener('touchend', upHandler);
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
    document.addEventListener('touchmove', moveHandler, { passive: false });
    document.addEventListener('touchend', upHandler);
  }

  private handleDragMove(e: MouseEvent | TouchEvent): void {
    if (!this.draggedPiece) return;
    e.preventDefault();

    const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
    const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;

    const workspace = document.getElementById('workspace') as HTMLElement;
    const workspaceRect = workspace.getBoundingClientRect();

    const newX = clientX - workspaceRect.left - this.dragOffsetX;
    const newY = clientY - workspaceRect.top - this.dragOffsetY;

    this.draggedPiece.currentX = newX;
    this.draggedPiece.currentY = newY;
    this.draggedPiece.element.style.left = `${newX}px`;
    this.draggedPiece.element.style.top = `${newY}px`;
  }

  private handleDragEnd(e: MouseEvent | TouchEvent): void {
    if (!this.draggedPiece) return;

    const piece = this.draggedPiece;
    piece.element.style.zIndex = '';

    const targetX = piece.correctX;
    const targetY = piece.correctY;

    const distance = Math.sqrt(
      Math.pow(piece.currentX - targetX, 2) +
      Math.pow(piece.currentY - targetY, 2)
    );

    if (distance < 30) {
      piece.currentX = targetX;
      piece.currentY = targetY;
      piece.isSnapped = true;
      piece.element.classList.add('snapped');
      piece.element.style.left = `${targetX}px`;
      piece.element.style.top = `${targetY}px`;

      this.placed++;
      this.updateStats();

      if (this.checkWin()) {
        this.handleWin();
      }
    }

    this.draggedPiece = null;
  }

  private shufflePieces(): void {
    this.repositionUnsnapped();
    this.placed = this.pieces.filter(p => p.isSnapped).length;
    this.updateStats();
  }

  private checkWin(): boolean {
    return this.pieces.every(p => p.isSnapped);
  }

  private handleWin(): void {
    this.isGameStarted = false;
    this.stopTimer();
    setTimeout(() => {
      alert(`Congratulations! You solved the puzzle in ${this.formatTime(this.timer)}!`);
    }, 300);
  }

  private startTimer(): void {
    this.timerInterval = window.setInterval(() => {
      this.timer++;
      this.updateStats();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private updateStats(): void {
    const placedElement = document.getElementById('placed') as HTMLElement;
    const timerElement = document.getElementById('timer') as HTMLElement;
    placedElement.textContent = this.placed.toString();
    timerElement.textContent = this.formatTime(this.timer);
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new JigsawPuzzle();
});
