import { useState, useEffect, useCallback } from 'react';
import { socket } from './socket';
import './App.css';

// --- Helper Functions & Constants ---
const checkConflict = (grid, index, value) => {
  if (value === null) return false;
  const row = Math.floor(index / 9);
  const col = index % 9;
  for (let i = 0; i < 9; i++) { const rowIndex = row * 9 + i; const colIndex = i * 9 + col; if (grid[rowIndex] === value && rowIndex !== index) return true; if (grid[colIndex] === value && colIndex !== index) return true; }
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) { const subGridIndex = (startRow + i) * 9 + (startCol + j); if (grid[subGridIndex] === value && subGridIndex !== index) return true; } }
  return false;
};

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const API_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';


// --- The Main App Component ---
function App() {
  // Game State
  const [initialPuzzle, setInitialPuzzle] = useState([]);
  const [puzzle, setPuzzle] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [mistakes, setMistakes] = useState([]);
  const [history, setHistory] = useState([]);
  const [difficulty, setDifficulty] = useState('medium');
  const [time, setTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isGameActive, setIsGameActive] = useState(false);

  // PvP State
  const [gameMode, setGameMode] = useState('solo');
  const [lobbyState, setLobbyState] = useState('default');
  const [roomId, setRoomId] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [opponentPuzzle, setOpponentPuzzle] = useState([]);
  const [gameMessage, setGameMessage] = useState('');

  // --- Game Logic Functions ---
  const startNewGame = useCallback(async (puzzleStr) => {
    let puzzleString = puzzleStr;
    setIsTimerRunning(false); setTime(0);
    if (!puzzleString) {
      try {
        setGameMessage('Fetching new puzzle...');
        const response = await fetch(`${API_URL}/api/new-puzzle?difficulty=${difficulty}`);
        const data = await response.json(); puzzleString = data.puzzle;
      } catch (error) {
        console.error("Failed to fetch new puzzle:", error);
        setGameMessage('Could not fetch puzzle. Using a default puzzle.');
        puzzleString = "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
      }
    }
    const initialGrid = puzzleString.split('').map(c => c === '.' ? null : Number(c));
    const currentGrid = [...initialGrid];
    setInitialPuzzle(initialGrid); setPuzzle(currentGrid); setSelectedCell(null); setMistakes([]); setHistory([currentGrid]); setGameMessage(''); setIsTimerRunning(true); setIsGameActive(true);
  }, [difficulty]);

  const handleSelectDifficulty = (level) => { setDifficulty(level); setIsGameActive(false); };
  const handleNumberInput = useCallback((number) => {
    if (selectedCell === null || initialPuzzle[selectedCell] !== null || gameMessage) return;
    const newPuzzle = [...puzzle]; newPuzzle[selectedCell] = number;
    const newMistakes = []; for(let i = 0; i < 81; i++) { if(newPuzzle[i] !== null && checkConflict(newPuzzle, i, newPuzzle[i])) newMistakes.push(i); }
    setPuzzle(newPuzzle); setMistakes(newMistakes); setHistory(prev => [...prev, newPuzzle]);
    if (gameMode === 'pvp-game') { socket.emit('playerMove', { roomId, puzzleState: newPuzzle }); }
    const isSolved = newPuzzle.every(cell => cell !== null);
    if (isSolved && newMistakes.length === 0) { const winMessage = gameMode === 'pvp-game' ? 'You Won!' : `Congratulations! Time: ${formatTime(time)}`; setGameMessage(winMessage); setIsTimerRunning(false); if (gameMode === 'pvp-game') socket.emit('gameOver', { roomId }); }
  }, [selectedCell, puzzle, initialPuzzle, gameMode, roomId, gameMessage, time]);
  const handleErase = useCallback(() => { if (selectedCell !== null && initialPuzzle[selectedCell] === null) handleNumberInput(null); }, [selectedCell, initialPuzzle, handleNumberInput]);
  const handleUndo = useCallback(() => { if (history.length > 1) { const newHistory = [...history]; newHistory.pop(); const lastState = newHistory[newHistory.length - 1]; setPuzzle(lastState); setHistory(newHistory); const newMistakes = []; for(let i = 0; i < 81; i++) { if(lastState[i] !== null && checkConflict(lastState, i, lastState[i])) newMistakes.push(i); } setMistakes(newMistakes); if(gameMode === 'pvp-game') socket.emit('playerMove', { roomId, puzzleState: lastState }); } }, [history, gameMode, roomId]);
  
  // --- PvP Logic ---
  const handleCreateRoom = async () => {
    try {
        setGameMessage('Fetching puzzle for new room...');
        const response = await fetch(`${API_URL}/api/new-puzzle?difficulty=${difficulty}`);
        const data = await response.json(); const puzzleString = data.puzzle;
        const initialGrid = puzzleString.split('').map(c => c === '.' ? null : Number(c));
        socket.emit('createRoom', { puzzle: puzzleString, initialPuzzle: initialGrid });
        setLobbyState('waiting');
    } catch (error) { alert("Could not create room. Failed to fetch a puzzle."); setGameMessage(''); }
  };
  const handleJoinRoom = () => { if (joinRoomId) socket.emit('joinRoom', { roomId: joinRoomId }); };
  const handleLeaveMatch = () => { socket.emit('leaveRoom', { roomId }); setGameMode('pvp-lobby'); setLobbyState('default'); setRoomId(''); setGameMessage(''); setIsTimerRunning(false); };
  const handleCancelRoom = () => { setLobbyState('default'); setGameMessage(''); setRoomId(''); };
  const handleCopyId = () => { navigator.clipboard.writeText(roomId); alert(`Room ID ${roomId} copied to clipboard!`); };
  const handleModeChange = (mode) => { setGameMode(mode); setIsGameActive(false); setLobbyState('default'); setGameMessage(''); setRoomId(''); setIsTimerRunning(false); setTime(0); };

  // --- UseEffect Hooks ---
  useEffect(() => {
    let interval; if (isTimerRunning) { interval = setInterval(() => { setTime(prevTime => prevTime + 1); }, 1000); }
    return () => clearInterval(interval);
  }, [isTimerRunning]);
  
  useEffect(() => {
    function onRoomCreated({ roomId }) { setRoomId(roomId); setGameMessage(''); }
    function onGameStart({ puzzle, initialPuzzle, roomId }) { setLobbyState('default'); setRoomId(roomId); setOpponentPuzzle(initialPuzzle); startNewGame(puzzle); setGameMode('pvp-game'); }
    function onOpponentMove(puzzleState) { setOpponentPuzzle(puzzleState); }
    function onOpponentWon() { setGameMessage('You Lost! Better luck next time.'); setIsTimerRunning(false); }
    function onOpponentLeft() { setGameMessage('Your opponent left the game.'); setIsTimerRunning(false); }
    function onError({ message }) { alert(message); setGameMessage(''); }
    socket.on('roomCreated', onRoomCreated); socket.on('gameStart', onGameStart); socket.on('opponentMove', onOpponentMove); socket.on('opponentWon', onOpponentWon); socket.on('opponentLeft', onOpponentLeft); socket.on('error', onError);
    return () => { socket.off('roomCreated', onRoomCreated); socket.off('gameStart', onGameStart); socket.off('opponentMove', onOpponentMove); socket.off('opponentWon', onOpponentWon); socket.off('opponentLeft', onOpponentLeft); socket.off('error', onError); };
  }, [startNewGame]);

  useEffect(() => {
    const handleKeyPress = (e) => { if (selectedCell === null || gameMessage || !isGameActive) return; if (/^[1-9]$/.test(e.key)) handleNumberInput(Number(e.key)); else if (e.key === 'Backspace' || e.key === 'Delete') handleErase(); };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedCell, handleNumberInput, handleErase, gameMessage, isGameActive]);

  const getCellClassName = (p, ip, sc, m, index) => { let c = 'cell'; if(ip[index]!==null) c+=' readonly'; if(sc===index) c+=' active'; if(m.includes(index)) c+=' error'; if(sc!==null){ const sr=Math.floor(sc/9), sc_c=sc%9, sb=Math.floor(sr/3)*3+Math.floor(sc_c/3), cr=Math.floor(index/9), cc=index%9, cb=Math.floor(cr/3)*3+Math.floor(cc/3); if(cr===sr||cc===sc_c||cb===sb) c+=' highlight'; } return c; };
  const renderGrid = (p, ip, sc, m, clickHandler, isOpponent = false) => ( <div className="sudoku-grid">{p && p.length > 0 && p.map((val, idx) => { const cellValue = isOpponent ? null : val; const className = isOpponent ? `cell ${val !== null ? 'filled' : ''}` : getCellClassName(p, ip, sc, m, idx); return ( <div key={idx} className={className} onClick={clickHandler ? () => clickHandler(idx) : null}>{cellValue}</div>); })}</div> );

  const difficultySelector = (
    <div className="difficulty-selector">
      <button onClick={() => handleSelectDifficulty('easy')} className={difficulty==='easy'?'active':''}>Easy</button>
      <button onClick={() => handleSelectDifficulty('medium')} className={difficulty==='medium'?'active':''}>Medium</button>
      <button onClick={() => handleSelectDifficulty('hard')} className={difficulty==='hard'?'active':''}>Hard</button>
    </div>
  );

  return (
    <div className="app-container">
      <div className="header">
        <h1>Sudoku Arena</h1>
        <div className="game-mode-selector">
          <button onClick={() => handleModeChange('solo')} className={gameMode==='solo'?'active':''}>Solo</button>
          <button onClick={() => handleModeChange('pvp-lobby')} className={gameMode!=='solo'?'active':''}>PvP</button>
        </div>
      </div>
      
      {gameMode !== 'pvp-lobby' && isGameActive && <div className="timer">{formatTime(time)}</div>}

      {gameMode === 'solo' && (
        <div className="game-area">
          {!isGameActive ? (
            <div className="pre-game-screen">
              <h2>Select Difficulty</h2>
              {difficultySelector}
              <button className="start-btn" onClick={() => startNewGame()}>Start Game</button>
            </div>
          ) : (
            <>
              {renderGrid(puzzle, initialPuzzle, selectedCell, mistakes, (idx) => setSelectedCell(idx))}
              <div className="controls">
                <div className="numpad">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => <button key={num} onClick={() => handleNumberInput(num)}>{num}</button>)}</div>
                <div className="actions"><button onClick={handleUndo}>Undo</button><button onClick={handleErase}>Erase</button><button onClick={() => setIsGameActive(false)}>New Game</button></div>
              </div>
            </>
          )}
        </div>
      )}

      {gameMode === 'pvp-lobby' && (
        <div className="pvp-lobby">
          {lobbyState === 'default' && (
            <>
              <h2>Player vs Player</h2>
              {difficultySelector}
              <button onClick={handleCreateRoom} className="create-room-btn">Create New Room</button>
              <hr/>
              {/* FIX: Wrap the join form in a div */}
              <div className="join-room-form">
                <input type="text" placeholder="Enter Room ID" value={joinRoomId} onChange={e => setJoinRoomId(e.target.value)} />
                <button onClick={handleJoinRoom}>Join Room</button>
              </div>
            </>
          )}
          {lobbyState === 'waiting' && (
            <div className="waiting-room">
                <h2>Room Created!</h2>
                <p>Share this ID with a friend:</p>
                <div className="room-id-display">{roomId}</div>
                <button onClick={handleCopyId} className="copy-btn">Copy ID</button>
                <p className="waiting-text">Waiting for opponent to join...</p>
                <button onClick={handleCancelRoom} className="cancel-btn">Cancel</button>
            </div>
          )}
        </div>
      )}
      
      {gameMode === 'pvp-game' && (
        <div className="pvp-game-area">
          <div className="player-area">
            <h3>You (Room: {roomId})</h3>
            {renderGrid(puzzle, initialPuzzle, selectedCell, mistakes, (idx) => setSelectedCell(idx))}
            <div className="controls">
                <div className="numpad">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => <button key={num} onClick={() => handleNumberInput(num)}>{num}</button>)}</div>
                <div className="actions"><button onClick={handleUndo}>Undo</button><button onClick={handleErase}>Erase</button><button onClick={handleLeaveMatch} className="leave-btn">Leave Match</button></div>
            </div>
          </div>
          <div className="opponent-grid">
            <h3>Opponent</h3>
            {renderGrid(opponentPuzzle, initialPuzzle, null, [], null, true)}
          </div>
        </div>
      )}
      <p className="game-message">{gameMessage}</p>
    </div>
  );
}

export default App;