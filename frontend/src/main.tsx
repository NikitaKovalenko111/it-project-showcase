import { restoreMockFiles } from './utils/mockFiles'
import { apiRuntime } from './api/runtime'
import { AutoSizeTextareas } from './components/AutoSizeTextareas'
import { ConfirmProvider } from './components/ConfirmProvider'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { store } from './store'
import { App } from './App'
import './styles/main.scss'

async function start() {
  if (apiRuntime.mode === 'mock') {
    try {
      await restoreMockFiles()
    } catch (error) {
      console.warn('Не удалось восстановить вложения демоверсии.', error)
    }
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Provider store={store}>
        <BrowserRouter>
          <ConfirmProvider>
            <AutoSizeTextareas />
            <App />
          </ConfirmProvider>
        </BrowserRouter>
      </Provider>
    </React.StrictMode>,
  )
}
void start()
