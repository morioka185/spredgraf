import React from 'react';
import './App.css';
import SpreadsheetViewer from './components/SpreadsheetViewer';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>スプレッドシートビューア</h1>
      </header>
      <main>
        <SpreadsheetViewer />
      </main>
    </div>
  );
}

export default App;