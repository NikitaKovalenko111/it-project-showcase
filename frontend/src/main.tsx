import {ConfirmProvider} from './components/ConfirmProvider'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { store } from './store'
import { App } from './App'
import './styles/main.scss'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ConfirmProvider><App /></ConfirmProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
)
