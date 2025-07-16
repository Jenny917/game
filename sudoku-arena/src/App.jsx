import { useState, useEffect, useCallback } from 'react';
import { socket } from './socket';
import './App.css';

// --- Helper Functions & Constants ---
const puzzles = [
  "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79",
  "..9748...7.........2.1.9.....7...24..64.1.59..98...3.....8.3.2.........6...2759..",
  "4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......",
];

const checkConflict = (grid, index, value) => {
  if (value === null) return false;
  const row = Math.floor(index / 9);
  const col = index % 9;

  for (let i = 0; i < 9; i++) {
    const rowIndex = row * 9 + i;
    const colIndex = i * 9 + col;
    if (grid[rowIndex] === value && rowIndex !== index) return true;
    if (grid[colIndex] === value && colIndex !== index) return true;
  }

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
  // Game State
  const [initialPuzzle, setInitialPuzzle] = useState([]);
  const [puzzle, setPuzzle] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [mistakes, setMistakes] = useState([]);
  const [history, setHistory] = useState([]);

  // PvP State
  const [gameMode, setGameMode] = useState('solo'); // 'solo', 'pvp-lobby', 'pvp-game'
  const [roomId, setRoomId] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [opponentPuzzle, setOpponentPuzzle] = useState([]);
  const [gameMessage, setGameMessage] = useState('');

  // --- Game Logic Functions (Solo & PvP) ---
  const startNewGame = useCallback((puzzleStr) => {
    const puzzleString = puzzleStr || puzzles[Math.floor(Math.random() * puzzles.length)];
    const initialGrid = puzzleString.split('').map(c => c === '.' ? null : Number(c));
    const currentGrid = [...initialGrid];
    setInitialPuzzle(initialGrid);
    setPuzzle(currentGrid);
    setSelectedCell(null);
    setMistakes([]);
    setHistory([currentGrid]);
    setGameMessage('');
  }, []);

  const handleNumberInput = useCallback((number) => {
    if (selectedCell === null || initialPuzzle[selectedCell] !== null || gameMessage) return;
    const newPuzzle = [...puzzle];
    newPuzzle[selectedCell] = number;
    const newMistakes = [];
    for(let i = 0; i < 81; i++) { if(newPuzzle[i] !== null && checkConflict(newPuzzle, i, newPuzzle[i])) newMistakes.push(i); }
    setPuzzle(newPuzzle);
    setMistakes(newMistakes);
    setHistory(prev => [...prev, newPuzzle]);
    if (gameMode === 'pvp-game') { socket.emit('playerMove', { roomId, puzzleState: newPuzzle }); }
    const isSolved = newPuzzle.every(cell => cell !== null);
    if (isSolved && newMistakes.length === 0) {
      const winMessage = gameMode === 'pvp-game' ? 'You Won!' : 'Congratulations!';
      setGameMessage(winMessage);
      if (gameMode === 'pvp-game') socket.emit('gameOver', { roomId });
    }
  }, [selectedCell, puzzle, initialPuzzle, gameMode, roomId, gameMessage]);

  const handleErase = useCallback(() => { if (selectedCell !== null && initialPuzzle[selectedCell] === null) handleNumberInput(null); }, [selectedCell, initialPuzzle, handleNumberInput]);
  const handleUndo = useCallback(() => { if (history.length > 1) { const newHistory = [...history]; newHistory.pop(); const lastState = newHistory[newHistory.length - 1]; setPuzzle(lastState); setHistory(newHistory); const newMistakes = []; for(let i = 0; i < 81; i++) { if(lastState[i] !== null && checkConflict(lastState, i, lastState[i])) newMistakes.push(i); } setMistakes(newMistakes); if(gameMode === 'pvp-game') socket.emit('playerMove', { roomId, puzzleState: lastState }); } }, [history, gameMode, roomId]);

  const handleCreateRoom = () => {
    const puzzleString = puzzles[Math.floor(Math.random() * puzzles.length)];
    const initialGrid = puzzleString.split('').map(c => c === '.' ? null : Number(c));
    socket.emit('createRoom', { puzzle: puzzleString, initialPuzzle: initialGrid });
    setGameMessage('Creating room...');
  };
  const handleJoinRoom = () => { if (joinRoomId) socket.emit('joinRoom', { roomId: joinRoomId }); };

  useEffect(() => { startNewGame(); }, [startNewGame]);

  useEffect(() => {
    function onRoomCreated({ roomId }) { setRoomId(roomId); setGameMessage(`Room ${roomId} created. Waiting for opponent...`); }
    function onGameStart({ puzzle, initialPuzzle, roomId }) { setRoomId(roomId); setOpponentPuzzle(initialPuzzle); startNewGame(puzzle); setGameMode('pvp-game'); }
    function onOpponentMove(puzzleState) { setOpponentPuzzle(puzzleState); }
    function onOpponentWon() { setGameMessage('You Lost! Better luck next time.'); }
    function onOpponentLeft() { setGameMessage('Your opponent left the game.'); }
    function onError({ message }) { alert(message); setGameMessage(''); }
    socket.on('roomCreated', onRoomCreated); socket.on('gameStart', onGameStart); socket.on('opponentMove', onOpponentMove); socket.on('opponentWon', onOpponentWon); socket.on('opponentLeft', onOpponentLeft); socket.on('error', onError);
    return () => { socket.off('roomCreated', onRoomCreated); socket.off('gameStart', onGameStart); socket.off('opponentMove', onOpponentMove); socket.off('opponentWon', onOpponentWon); socket.off('opponentLeft', onOpponentLeft); socket.off('error', onError); };
  }, [startNewGame]);

  useEffect(() => {
    const handleKeyPress = (e) => { if (selectedCell === null || gameMessage) return; if (/^[1-9]$/.test(e.key)) handleNumberInput(Number(e.key)); else if (e.key === 'Backspace' || e.key === 'Delete') handleErase(); };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedCell, handleNumberInput, handleErase, gameMessage]);

  const getCellClassName = (p, ip, sc, m, index) => { let c = 'cell'; if(ip[index]!==null) c+=' readonly'; if(sc===index) c+=' active'; if(m.includes(index)) c+=' error'; if(sc!==null){ const sr=Math.floor(sc/9), sc_c=sc%9, sb=Math.floor(sr/3)*3+Math.floor(sc_c/3), cr=Math.floor(index/9), cc=index%9, cb=Math.floor(cr/3)*3+Math.floor(cc/3); if(cr===sr||cc===sc_c||cb===sb) c+=' highlight'; } return c; };
  
  const renderGrid = (p, ip, sc, m, clickHandler, isOpponent = false) => (
    <div className="sudoku-grid">
      {p.map((val, idx) => {
        const cellValue = isOpponent ? null : val;
        const className = isOpponent 
          ? `cell ${val !== null ? 'filled' : ''}` 
          : getCellClassName(p, ip, sc, m, idx);
        return ( <div key={idx} className={className} onClick={clickHandler ? () => clickHandler(idx) : null}>{cellValue}</div>);
      })}
    </div>
  );

  return (
    <div className="app-container">
      <div className="header">
        <h1>Sudoku</h1>
        <div className="game-mode-selector">
          <button onClick={() => { setGameMode('solo'); startNewGame(); }} className={gameMode==='solo'?'active':''}>Solo</button>
          <button onClick={() => { setGameMode('pvp-lobby'); setGameMessage(''); setRoomId(''); }} className={gameMode!=='solo'?'active':''}>PvP</button>
        </div>
      </div>

      {gameMode === 'solo' && ( <div className="game-area">{renderGrid(puzzle, initialPuzzle, selectedCell, mistakes, (idx) => setSelectedCell(idx))}</div> )}

      {gameMode === 'pvp-lobby' && (
        <div className="pvp-lobby">
          <h2>Player vs Player</h2>
          <button onClick={handleCreateRoom}>Create New Room</button>
          <hr/>
          <input type="text" placeholder="Enter Room ID" value={joinRoomId} onChange={e => setJoinRoomId(e.target.value)} />
          <button onClick={handleJoinRoom}>Join Room</button>
        </div>
      )}
      
      {gameMode === 'pvp-game' && (
        <div className="pvp-game-area">
          <div className="player-grid"><h3>You (Room: {roomId})</h3>{renderGrid(puzzle, initialPuzzle, selectedCell, mistakes, (idx) => setSelectedCell(idx))}</div>
          <div className="opponent-grid"><h3>Opponent</h3>{renderGrid(opponentPuzzle, initialPuzzle, null, [], null, true)}</div>
        </div>
      )}

      {(gameMode !== 'pvp-lobby') && (
        <div className="controls">
          <div className="numpad">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => <button key={num} onClick={() => handleNumberInput(num)}>{num}</button>)}</div>
          <div className="actions"><button onClick={handleUndo}>Undo</button><button onClick={handleErase}>Erase</button><button onClick={startNewGame}>New Game</button></div>
        </div>
      )}

      <p className="game-message">{gameMessage}</p>
    </div>
  );
}

export default App;