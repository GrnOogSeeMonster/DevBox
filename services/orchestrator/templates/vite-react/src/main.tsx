import React from 'react'
import ReactDOM from 'react-dom/client'

function App(){
  return (
    <div style={{ padding: 24 }}>
      <h1>Vite + React Sandbox</h1>
      <p>Edit files in /workspace and see hot reload.</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
