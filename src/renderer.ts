import './index.css';
import svgContent from '../assets/jigsaw.svg?raw';

const idolImages = [
  '../assets/images/cigarette-taemin.jpeg',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop'
];

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

class JigsawPuzzle {
  private gridSize: number = 10;
  private pieceSize: number = 60;
  private overhang: number = 15;
  private elementSize: number = 90;
  private pieces: PuzzlePiece[] = [];
  private moves: number = 0;
  private timer: number = 0;
  private timerInterval: number | null = null;
  private currentImageIndex: number = 0;
  private isGameStarted: boolean = false;
  private draggedPiece: PuzzlePiece | null = null;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;
  private verticalCutLines: string[][] = [];
  private horizontalCutLines: string[][] = [];
  private pathsLoaded: boolean = false;

  constructor() {
    this.initializeEventListeners();
    this.loadPreviewImage();
  }

  private initializeEventListeners(): void {
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    const shuffleBtn = document.getElementById('shuffleBtn') as HTMLButtonElement;
    const imageSelect = document.getElementById('imageSelect') as HTMLSelectElement;

    startBtn.addEventListener('click', () => this.startGame());
    shuffleBtn.addEventListener('click', () => this.shufflePieces());
    imageSelect.addEventListener('change', (e) => {
      this.currentImageIndex = parseInt((e.target as HTMLSelectElement).value);
      this.loadPreviewImage();
      this.startGame();
    });
  }

  private loadPreviewImage(): void {
    const previewImage = document.getElementById('previewImage') as HTMLImageElement;
    previewImage.src = idolImages[this.currentImageIndex];
  }

  private startGame(): void {
    this.moves = 0;
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
    workspace.innerHTML = '';

    this.generatePieceClipPaths();

    const totalSize = this.pieceSize * this.gridSize;
    const offsetX = (800 - totalSize) / 2;
    const offsetY = (600 - totalSize) / 2;

    this.pieces = [];

    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        const pieceId = row * this.gridSize + col;
        const piece = this.createPiece(pieceId, row, col, offsetX, offsetY);
        this.pieces.push(piece);
        workspace.appendChild(piece.element);
      }
    }
  }

  private createPiece(id: number, row: number, col: number, offsetX: number, offsetY: number): PuzzlePiece {
    const element = document.createElement('div');
    element.className = 'puzzle-piece';
    element.style.width = `${this.elementSize}px`;
    element.style.height = `${this.elementSize}px`;
    element.dataset.id = id.toString();

    const bgX = -(col * this.pieceSize) + this.overhang;
    const bgY = -(row * this.pieceSize) + this.overhang;

    element.style.backgroundImage = `url(${idolImages[this.currentImageIndex]})`;
    element.style.backgroundPosition = `${bgX}px ${bgY}px`;
    element.style.backgroundSize = `${this.pieceSize * this.gridSize}px ${this.pieceSize * this.gridSize}px`;

    element.style.clipPath = `url(#clip-${row}-${col})`;
    element.style.webkitClipPath = `url(#clip-${row}-${col})`;

    element.addEventListener('mousedown', (e) => this.handleDragStart(e, id));
    element.addEventListener('touchstart', (e) => this.handleDragStart(e, id), { passive: false });

    const correctX = offsetX + col * this.pieceSize - this.overhang;
    const correctY = offsetY + row * this.pieceSize - this.overhang;

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

      this.moves++;
      this.updateStats();

      if (this.checkWin()) {
        this.handleWin();
      }
    }

    this.draggedPiece = null;
  }

  private shufflePieces(): void {
    const workspace = document.getElementById('workspace') as HTMLElement;
    const workspaceRect = workspace.getBoundingClientRect();

    this.pieces.forEach(piece => {
      if (!piece.isSnapped) {
        const maxX = workspaceRect.width - this.elementSize;
        const maxY = workspaceRect.height - this.elementSize;

        piece.currentX = Math.random() * maxX;
        piece.currentY = Math.random() * maxY;
        piece.element.style.left = `${piece.currentX}px`;
        piece.element.style.top = `${piece.currentY}px`;

        workspace.appendChild(piece.element);
      }
    });

    this.moves = 0;
    this.updateStats();
  }

  private checkWin(): boolean {
    return this.pieces.every(p => p.isSnapped);
  }

  private handleWin(): void {
    this.isGameStarted = false;
    this.stopTimer();
    setTimeout(() => {
      alert(`Congratulations! You solved the puzzle in ${this.moves} moves and ${this.formatTime(this.timer)}!`);
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
    const movesElement = document.getElementById('moves') as HTMLElement;
    const timerElement = document.getElementById('timer') as HTMLElement;
    movesElement.textContent = this.moves.toString();
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
