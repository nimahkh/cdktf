import { useEffect, useState } from 'react'
import './App.css'
import axios from 'axios';

function App() {
  const [count, setCount] = useState(0)
  const [name, setName] = useState('')

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_BASE_URL}/hello`).then((response) => {
      setName(response.data);
    });
  }, []);

  return (
    <>
      <h1>Vite + React | {name} </h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
