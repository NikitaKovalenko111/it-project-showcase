import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

// Run explicitly against a local, seeded QA stand. The smoke creates marked QA records.
const base = 'http://127.0.0.1:3001'
const password = process.env.SHOWCASE_QA_PASSWORD
assert.ok(password, 'Set SHOWCASE_QA_PASSWORD to the local QA account password.')
const browser =
  process.env.SHOWCASE_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const profile = await mkdtemp(join(tmpdir(), 'showcase-chrome-'))
const chrome = spawn(
  browser,
  [
    '--headless=new',
    '--remote-debugging-port=0',
    '--user-data-dir=' + profile,
    '--disable-background-networking',
    '--no-first-run',
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
)
let startupError
chrome.on('error', (error) => {
  startupError = error
})

async function until(check, message) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (startupError) throw startupError
    const value = await check()
    if (value) return value
    await delay(150)
  }
  throw new Error(message)
}

let ws
let run
try {
  const port = await until(async () => {
    const file = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')
    return file.split('\n')[0].trim()
  }, 'Chrome did not start')
  const version = await fetch('http://127.0.0.1:' + port + '/json/version').then((response) =>
    response.json(),
  )
  ws = new WebSocket(version.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  let sequence = 0
  const requests = new Map()
  const responses = []
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    if (message.method === 'Network.responseReceived') responses.push(message.params)
    const pending = requests.get(message.id)
    if (!pending) return
    requests.delete(message.id)
    if (message.error) pending.reject(new Error(message.error.message))
    else pending.resolve(message.result)
  }
  const send = (method, params, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++sequence
      requests.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params, sessionId }))
    })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const cdp = (method, params = {}) => send(method, params, sessionId)
  run = async (operation, ...args) => {
    const expression = '(' + operation.toString() + ')(...' + JSON.stringify(args) + ')'
    const reply = await cdp('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (reply.exceptionDetails)
      throw new Error(reply.exceptionDetails.exception?.description || reply.exceptionDetails.text)
    return reply.result.value
  }
  await cdp('Network.enable')
  const exists = (selector) => run((value) => !!document.querySelector(value), selector)
  const has = (text) => run((value) => document.body.innerText.includes(value), text)
  const open = async (route, selector) => {
    await cdp('Page.navigate', { url: base + route })
    await until(() => exists(selector), 'Missing ' + selector + ' on ' + route)
  }
  const set = (selector, value) =>
    run(
      (selector, value) => {
        const field = document.querySelector(selector)
        if (!field) throw new Error('Missing field ' + selector)
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set.call(
          field,
          value,
        )
        field.dispatchEvent(
          new Event(field.matches('select') ? 'change' : 'input', { bubbles: true }),
        )
      },
      selector,
      value,
    )
  const click = async (text, scope = 'body', context = '') => {
    await until(
      () =>
        run(
          (text, scope, context) => {
            const container = Array.from(document.querySelectorAll(scope)).find((row) =>
              row.textContent.includes(context),
            )
            const button = Array.from(container?.querySelectorAll('button, a') || []).find(
              (item) =>
                !item.disabled && item.offsetWidth > 0 && item.textContent.trim().includes(text),
            )
            button?.click()
            return !!button
          },
          text,
          scope,
          context,
        ),
      'Missing action ' + text,
    )
  }
  async function login(login) {
    if (await exists('.logout-btn-isu')) await click('Выйти')
    await open('/login', '#login-username')
    await set('#login-username', login)
    await set('#login-password', password)
    await click('Войти в систему')
    await until(() => exists('.logout-btn-isu'), 'Login failed ' + login)
  }
  async function created(path, start) {
    const request = await until(
      () =>
        responses
          .slice(start)
          .find(
            ({ response }) => response.url.endsWith('/api/v1' + path) && response.status === 201,
          ),
      'Create failed ' + path,
    )
    const { body } = await cdp('Network.getResponseBody', { requestId: request.requestId })
    return JSON.parse(body)
  }
  const date = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
  const stamp = Date.now()
  const prefix = '[QA frontend ' + stamp + ']'
  await login('qa.company1')
  await open('/cases', 'select[aria-label="Статус набора"]')
  await click('Разместить публикацию')
  await click('Отправить на модерацию', 'dialog[open]')
  assert.equal(await run(() => document.activeElement.name), 'title')
  assert.equal(await run(() => document.activeElement.getAttribute('aria-invalid')), 'true')
  await until(
    () =>
      run(() => getComputedStyle(document.activeElement).backgroundColor === 'rgb(252, 245, 245)'),
    'Invalid input color did not update',
  )
  assert.equal(
    await run(() => {
      document
        .querySelector('dialog[open] input[type=file]')
        .dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true }))
      return !!document.querySelector('dialog[open]')
    }),
    true,
  )
  const title = prefix + ' Кейс'
  await set('dialog [name=title]', title)
  await set('dialog [name=summary]', 'Краткое описание проверки публикации')
  await set('dialog [name=description]', 'Разработать прототип для проверки полного цикла заявки.')
  await set('dialog [name=deadline]', date(25))
  await set('dialog [name=registrationDeadline]', date(15))
  await set('dialog input[placeholder="Например, 30"]', '8')
  await set('dialog select:has(option[value=individual])', 'individual')
  let start = responses.length
  await click('Отправить на модерацию', 'dialog[open]')
  const ordinary = await created('/cases', start)
  await until(async () => !(await exists('dialog[open]')), 'Case submission did not close the form')
  await click('Разместить публикацию')
  await set('dialog select:has(option[value=hackathon])', 'hackathon')
  const hackathonTitle = prefix + ' Хакатон NDA'
  await set('dialog [name=title]', hackathonTitle)
  await set('dialog [name=summary]', 'Проверка публикации мероприятия с NDA')
  await set('dialog [name=description]', 'Подготовить прототип и презентацию.')
  await set('dialog [name=deadline]', date(25))
  await set('dialog [name=registrationDeadline]', date(15))
  await set('dialog input[placeholder="Например, 30"]', '8')
  await run(() => document.querySelector('.nda-checkbox-field input').click())
  await set('dialog [name=ndaText]', 'Тестовый текст соглашения для локального стенда.')
  start = responses.length
  await click('Создать черновик', 'dialog[open]')
  const hackathon = await created('/cases', start)
  await until(() => exists('.event-plan--editor'), 'Missing event plan editor')
  await set('[name=subject]', 'Тест площадки')
  await set('[name=platform_name]', 'Локальная площадка')
  await set('[name=platform_url]', 'https://example.test/qa')
  await click('Сохранить план мероприятия')
  await until(() => has('План сохранён'), 'Plan save failed')
  await click('Отправить на модерацию')
  if (await exists('dialog.confirm-dialog[open]'))
    await click('Подтвердить', 'dialog.confirm-dialog[open]')
  await until(() => has('На рассмотрении'), 'Hackathon submission failed')

  await login('qa.admin')
  await open('/cases', 'select[aria-label="Статус набора"]')
  assert.equal(await has('Разместить публикацию'), false)
  await open('/cases/' + hackathon.case_id, '.case-detail-layout')
  assert.equal(await has('Редактировать кейс'), false)
  await open('/companies?review=cases', '.review-list, [aria-live=polite]')
  for (const name of [hackathonTitle, title]) {
    await set('input[placeholder="Поиск кейсов на модерации"]', name)
    await click('Одобрить и опубликовать', '.review-list article.card', name)
    await until(
      async () =>
        !(await run(
          (value) =>
            Array.from(document.querySelectorAll('.review-list article.card')).some((item) =>
              item.innerText.includes(value),
            ),
          name,
        )),
      'Approval failed for ' + name,
    )
  }

  await login('qa.student1')
  await open('/cases/' + ordinary.case_id, '.case-detail-layout')
  await click('Подать заявку')
  await until(() => exists('[aria-labelledby=application-title]'), 'Application form missing')
  await set(
    '[aria-labelledby=application-title] textarea',
    'Готов выполнить задачу и показать прототип.',
  )
  await run(() => {
    const dialog = document.querySelector('[aria-labelledby=application-title]')
    dialog.querySelector('input[type=checkbox][required]').click()
  })
  start = responses.length
  await click('Отправить заявку', '[aria-labelledby=application-title]')
  await created('/applications', start)
  await until(() => has('Заявка отправлена'), 'Application confirmation missing')

  await login('qa.company1')
  await open('/company-applications?caseId=' + ordinary.case_id, '.company-applications-page')
  await click('Принять в команду', '.application-card', title)
  await until(() => has('Заявка принята'), 'Application acceptance missing')

  await open('/internships', '.opportunity-filters')
  await click('Разместить')
  await until(() => exists('dialog[open] [name=application_deadline]'), 'Missing opportunity form')
  await set('dialog [name=title]', prefix + ' Стажировка')
  await set('dialog [name=summary]', 'Описание стажировки для проверки формы.')
  await set('dialog input[type=number]', '10')
  await set('dialog [name=application_deadline]', date(15))
  await set(
    'dialog textarea[aria-labelledby=opportunity-program-label]',
    'Программа стажировки для проверки.',
  )
  assert.equal(
    await run(() => document.querySelector('[name=application_deadline]').value),
    date(15),
  )
  assert.equal(
    await run(() => document.querySelector('dialog[open] input[readonly]').readOnly),
    true,
  )
  start = responses.length
  await click('Отправить на модерацию', 'dialog[open]')
  const internship = await created('/internships', start)
  await until(() => has('Публикация отправлена на модерацию'), 'Opportunity confirmation missing')
  const programRoute = '/internships?kind=internship&program=' + internship.program_id
  await login('qa.admin')
  await open(programRoute, '.program-review-actions')
  await click('Одобрить и опубликовать', '.program-review-actions')
  await until(async () => !(await exists('.program-review-actions')), 'Opportunity approval failed')

  await login('qa.student1')
  await open('/cases/' + hackathon.case_id, '.case-detail-layout')
  await click('Ознакомиться и подписать NDA')
  await until(
    () => has('Тестовый текст соглашения для локального стенда.'),
    'Exact NDA text missing',
  )
  await click('Отклонить и закрыть')

  await open(programRoute, '.opportunity-apply-dialog')
  await click('Подать заявку')
  await set('.opportunity-apply-dialog textarea', 'Хочу пройти стажировку в вашей команде.')
  start = responses.length
  await click('Отправить заявку', '.opportunity-apply-dialog')
  await created('/internships/' + internship.program_id + '/applications', start)
  await until(() => has('Заявка отправлена'), 'Internship application confirmation missing')
  await click('К витрине', '.program-detail-toolbar')
  await until(() => exists('.opportunity-filters'), 'Internship catalog did not reopen')
  assert.equal(await has('Заявка отправлена'), false)

  await login('qa.company1')
  await open('/company-applications?kind=internship', '.company-applications-page')
  await until(
    () => has(prefix + ' Стажировка'),
    'Internship application missing from student applications',
  )
  await click('Отклонить', 'tr', prefix + ' Стажировка')
  await until(
    () =>
      run(
        (title) =>
          Array.from(document.querySelectorAll('tr')).some(
            (row) => row.innerText.includes(title) && row.innerText.includes('Отклонена'),
          ),
        prefix + ' Стажировка',
      ),
    'Internship rejection failed',
  )

  console.log(
    'PASS: case and hackathon creation, NDA and plan, admin moderation, case acceptance and internship rejection in the student applications queue',
  )
} catch (error) {
  if (run) console.error(await run(() => document.body.innerText.slice(-2200)).catch(() => ''))
  throw error
} finally {
  ws?.close()
  chrome.kill()
}
