import { SelectMenus } from './components/SelectMenus'
import { restoreMockFiles } from './utils/mockFiles'
import { isMockMode } from './api/runtime'
import { loadMockRuntime } from './api/mockRuntime'
import { loadLocalShowcase } from './api/localShowcase'
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
  if (isMockMode) {
    await loadMockRuntime()
    try {
      await restoreMockFiles()
    } catch (error) {
      console.warn('Не удалось восстановить вложения демоверсии.', error)
    }
  } else {
    await loadLocalShowcase()
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Provider store={store}>
        <BrowserRouter>
          <ConfirmProvider>
            <AutoSizeTextareas />
            <SelectMenus />
            <App />
          </ConfirmProvider>
        </BrowserRouter>
      </Provider>
    </React.StrictMode>,
  )
}
void start()
