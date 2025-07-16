import { useState, useEffect, useCallback } from 'react';
import './App.css';

// --- Helper Functions & Constants ---

// A few puzzles to cycle through
const puzzles = [
  "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79",
  "..9748...7.........2.1.9.....7...24..64.1.59..98...3.....8.3.2.........6...2759..",
  "4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......",
];

// Function to check if a number causes a conflict in its row, column, or 3x3 box
const checkConflict = (grid, index, value) => {
  if (value === null) return false;
  const row = Math.floor(index / 9);
  const col = index % 9;

  // Check row and column
  for (let i = 0; i < 9; i++) {
    const rowIndex = row * 9 + i;
    const colIndex = i * 9 + col;
    if (grid[rowIndex] === value && rowIndex !== index) return true;
    if (grid[colIndex] === value && colIndex !== index) return true;
  }

  // Check 3x3 subgrid
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const subGridIndex = (startRow + i) * 9 + (startCol + j);
      if (grid[subGridIndex] === value && subGridIndex !== index) return true;
    }
  }
  return false;
};


// --- The Main App Component ---

function App() {
  const [initialPuzzle, setInitialPuzzle] = useState([]);
  const [puzzle, setPuzzle] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [mistakes, setMistakes] = useState([]);
  const [history, setHistory] = useState([]);

  const startNewGame = useCallback(() => {
    const puzzleString = puzzles[Math.floor(Math.random() * puzzles.length)];
    const initialGrid = puzzleString.split('').map(c => c === '.' ? null : Number(c));
    const currentGrid = [...initialGrid];
    
    setInitialPuzzle(initialGrid);
    setPuzzle(currentGrid);
    setSelectedCell(null);
    setMistakes([]);
    setHistory([currentGrid]); // Start history with the initial grid
  }, []);

  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  const handleCellClick = (index) => {
    setSelectedCell(index);
  };

  const handleNumberInput = useCallback((number) => {
    if (selectedCell === null || initialPuzzle[selectedCell] !== null) {
      return; // Can't change initial numbers
    }

    const newPuzzle = [...puzzle];
    newPuzzle[selectedCell] = number;

    const newMistakes = [];
    for(let i = 0; i < 81; i++) {
      if(newPuzzle[i] !== null && checkConflict(newPuzzle, i, newPuzzle[i])) {
        newMistakes.push(i);
      }
    }
    
    setPuzzle(newPuzzle);
    setMistakes(newMistakes);
    setHistory(prev => [...prev, newPuzzle]); // Add new state to history
  }, [selectedCell, puzzle, initialPuzzle]);

  const handleErase = useCallback(() => {
    if (selectedCell !== null && initialPuzzle[selectedCell] === null) {
      handleNumberInput(null);
    }
  }, [selectedCell, initialPuzzle, handleNumberInput]);
  
  const handleUndo = useCallback(() => {
    if (history.length > 1) { // Can't undo the initial state
      const newHistory = [...history];
      newHistory.pop(); // Remove current state
      const lastState = newHistory[newHistory.length - 1];
      
      setPuzzle(lastState);
      setHistory(newHistory);
      // Re-calculate mistakes for the restored state
      const newMistakes = [];
      for(let i = 0; i < 81; i++) {
        if(lastState[i] !== null && checkConflict(lastState, i, lastState[i])) {
          newMistakes.push(i);
        }
      }
      setMistakes(newMistakes);
    }
  }, [history]);
  
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (selectedCell === null) return;
      if (/^[1-9]$/.test(e.key)) {
        handleNumberInput(Number(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleErase();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedCell, handleNumberInput, handleErase]);

  const getCellClassName = (index) => {
    let classes = 'cell';
    if (initialPuzzle[index] !== null) classes += ' readonly';
    if (selectedCell === index) classes += ' active';
    if (mistakes.includes(index)) classes += ' error';

    if (selectedCell !== null) {
      const selectedRow = Math.floor(selectedCell / 9);
      const selectedCol = selectedCell % 9;
      const selectedBox = Math.floor(Math.floor(selectedCell / 9) / 3) * 3 + Math.floor((selectedCell % 9) / 3);
      
      const currentRow = Math.floor(index / 9);
      const currentCol = index % 9;
      const currentBox = Math.floor(Math.floor(index / 9) / 3) * 3 + Math.floor((index % 9) / 3);

      if (currentRow === selectedRow || currentCol === selectedCol || currentBox === selectedBox) {
        classes += ' highlight';
      }
    }
    return classes;
  };

  return (
    <div className="app-container">
      <h1>Sudoku</h1>
      <div className="sudoku-grid">
        {puzzle.map((value, index) => (
          <div
            key={index}
            className={getCellClassName(index)}
            onClick={() => handleCellClick(index)}
          >
            {value}
          </div>
        ))}
      </div>
      <div className="controls">
        <div className="numpad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} onClick={() => handleNumberInput(num)}>{num}</button>
          ))}
        </div>
        <div className="actions">
          <button onClick={handleUndo}>Undo</button>
          <button onClick={handleErase}>Erase</button>
          <button onClick={startNewGame}>New Game</button>
        </div>
      </div>
    </div>
  );
}

export default App;