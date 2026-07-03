import './index.css';

// K-pop idol images
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

interface TabPattern {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

class JigsawPuzzle {
  private gridSize: number = 4;
  private pieceSize: number = 100;
  private pieces: PuzzlePiece[] = [];
  private moves: number = 0;
  private timer: number = 0;
  private timerInterval: number | null = null;
  private currentImageIndex: number = 0;
  private isGameStarted: boolean = false;
  private draggedPiece: PuzzlePiece | null = null;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;
  private tabPatterns: TabPattern[][] = [];

  constructor() {
    this.initializeEventListeners();
    this.loadPreviewImage();
  }

  private initializeEventListeners(): void {
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    const shuffleBtn = document.getElementById('shuffleBtn') as HTMLButtonElement;
    const difficultySelect = document.getElementById('difficulty') as HTMLSelectElement;
    const imageSelect = document.getElementById('imageSelect') as HTMLSelectElement;

    startBtn.addEventListener('click', () => this.startGame());
    shuffleBtn.addEventListener('click', () => this.shufflePieces());
    difficultySelect.addEventListener('change', (e) => {
      this.gridSize = parseInt((e.target as HTMLSelectElement).value);
      this.startGame();
    });
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
    this.initializePuzzle();
    this.shufflePieces();
  }

  private initializePuzzle(): void {
    const workspace = document.getElementById('workspace') as HTMLElement;
    
    workspace.innerHTML = '';

    // Generate consistent tab patterns
    this.generateTabPatterns();

    // Generate SVG masks
    this.generateMasks();

    // Calculate workspace center for puzzle placement
    const totalSize = this.pieceSize * this.gridSize;
    const offsetX = (800 - totalSize) / 2;
    const offsetY = (600 - totalSize) / 2;

    this.pieces = [];

    // Create puzzle pieces
    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        const pieceId = row * this.gridSize + col;
        const piece = this.createPiece(pieceId, row, col, offsetX, offsetY);
        this.pieces.push(piece);
        workspace.appendChild(piece.element);
      }
    }
  }

  private generateTabPatterns(): void {
    this.tabPatterns = [];
    
    for (let row = 0; row < this.gridSize; row++) {
      this.tabPatterns[row] = [];
      for (let col = 0; col < this.gridSize; col++) {
        const pattern: TabPattern = {
          top: row === 0 ? 0 : (this.tabPatterns[row - 1][col].bottom * -1),
          left: col === 0 ? 0 : (this.tabPatterns[row][col - 1].right * -1),
          right: col === this.gridSize - 1 ? 0 : (Math.random() > 0.5 ? 1 : -1),
          bottom: row === this.gridSize - 1 ? 0 : (Math.random() > 0.5 ? 1 : -1)
        };
        this.tabPatterns[row][col] = pattern;
      }
    }
  }

  private generateMasks(): void {
    const masksContainer = document.getElementById('masks-container') as HTMLElement;
    masksContainer.innerHTML = '';

    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        const mask = this.createMask(row, col);
        masksContainer.appendChild(mask);
      }
    }
  }

  private createMask(row: number, col: number): SVGElement {
    const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.setAttribute('id', `mask-${row}-${col}`);
    mask.setAttribute('maskContentUnits', 'objectBoundingBox');

    const pattern = this.tabPatterns[row][col];

    // Base rectangle (white = visible) - slightly larger for better fit
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0.1');
    rect.setAttribute('y', '0.1');
    rect.setAttribute('width', '0.8');
    rect.setAttribute('height', '0.8');
    rect.setAttribute('fill', 'white');
    mask.appendChild(rect);

    // Add circles for tabs (black = hidden, white = visible)
    // Top tab
    if (pattern.top !== 0) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '0.5');
      circle.setAttribute('cy', '0.125');
      circle.setAttribute('r', '0.125');
      circle.setAttribute('fill', pattern.top === 1 ? 'white' : 'black');
      mask.appendChild(circle);
    }

    // Right tab
    if (pattern.right !== 0) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '0.875');
      circle.setAttribute('cy', '0.5');
      circle.setAttribute('r', '0.125');
      circle.setAttribute('fill', pattern.right === 1 ? 'white' : 'black');
      mask.appendChild(circle);
    }

    // Bottom tab
    if (pattern.bottom !== 0) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '0.5');
      circle.setAttribute('cy', '0.875');
      circle.setAttribute('r', '0.125');
      circle.setAttribute('fill', pattern.bottom === 1 ? 'white' : 'black');
      mask.appendChild(circle);
    }

    // Left tab
    if (pattern.left !== 0) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '0.125');
      circle.setAttribute('cy', '0.5');
      circle.setAttribute('r', '0.125');
      circle.setAttribute('fill', pattern.left === 1 ? 'white' : 'black');
      mask.appendChild(circle);
    }

    return mask;
  }

  private createPiece(id: number, row: number, col: number, offsetX: number, offsetY: number): PuzzlePiece {
    const element = document.createElement('div');
    element.className = 'puzzle-piece';
    element.style.width = `${this.pieceSize}px`;
    element.style.height = `${this.pieceSize}px`;
    element.dataset.id = id.toString();

    // Use background image with mask
    const totalSize = this.pieceSize * this.gridSize;
    const backgroundPositionX = -(col * this.pieceSize);
    const backgroundPositionY = -(row * this.pieceSize);

    element.style.backgroundImage = `url(${idolImages[this.currentImageIndex]})`;
    element.style.backgroundPosition = `${backgroundPositionX}px ${backgroundPositionY}px`;
    element.style.backgroundSize = `${totalSize}px ${totalSize}px`;
    
    // Apply SVG mask
    element.style.maskImage = `url(#mask-${row}-${col})`;
    element.style.webkitMaskImage = `url(#mask-${row}-${col})`;

    // Add drag events
    element.addEventListener('mousedown', (e) => this.handleDragStart(e, id));
    element.addEventListener('touchstart', (e) => this.handleDragStart(e, id), { passive: false });

    const correctX = offsetX + col * this.pieceSize;
    const correctY = offsetY + row * this.pieceSize;

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

    // Check if piece is near its correct position
    const targetX = piece.correctX;
    const targetY = piece.correctY;

    const distance = Math.sqrt(
      Math.pow(piece.currentX - targetX, 2) + 
      Math.pow(piece.currentY - targetY, 2)
    );

    if (distance < 30) {
      // Snap to correct position
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
        const maxX = workspaceRect.width - this.pieceSize;
        const maxY = workspaceRect.height - this.pieceSize;
        
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
      alert(`🎉 Congratulations! You solved the puzzle in ${this.moves} moves and ${this.formatTime(this.timer)}!`);
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

// Initialize the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new JigsawPuzzle();
});
