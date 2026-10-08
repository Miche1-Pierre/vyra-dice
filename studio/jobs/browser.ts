import { spawn } from "node:child_process"
import { existsSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

/*
 * Headless Chrome driven over the DevTools protocol, for the captures of a generated demo.
 * Same tooling as the before/after captures of VYR-58: frozen animations (?freeze=12),
 * desktop and phone viewports, screenshots.
 */

const PORT = 9334
/** Chrome: VYRA_CHROME, else where its installer puts it on this system. */
const CHROME =
  process.env.VYRA_CHROME ??
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ].find((p) => existsSync(p)) ??
  "google-chrome"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Message = {
  id?: number
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: unknown
}

async function version(): Promise<unknown> {
  try {
    return await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
  } catch {
    return null
  }
}

export class Browser {
  private ws!: WebSocket
  private seq = 0
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private listeners = new Set<(m: Message) => void>()
  readonly errors: string[] = []

  static async open(): Promise<Browser> {
    if (!(await version())) {
      const child = spawn(
        CHROME,
        [
          "--headless=new",
          `--remote-debugging-port=${PORT}`,
          `--user-data-dir=${path.join(os.tmpdir(), "vyra-studio-chrome")}`,
          "--window-size=1440,900",
          "--hide-scrollbars",
          "--ignore-gpu-blocklist",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-background-timer-throttling",
          "--disable-renderer-backgrounding",
          "about:blank",
        ],
        { detached: true, stdio: "ignore" },
      )
      child.unref()
      for (let i = 0; i < 80 && !(await version()); i++) await sleep(250)
    }
    const targets = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()) as {
      type: string
      webSocketDebuggerUrl: string
    }[]
    let page = targets.find((t) => t.type === "page")
    if (!page) {
      page = (await (
        await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })
      ).json()) as {
        type: string
        webSocketDebuggerUrl: string
      }
    }
    const b = new Browser()
    b.ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      b.ws.onopen = resolve
      b.ws.onerror = reject
    })
    b.ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as Message
      if (msg.id && b.pending.has(msg.id)) {
        const p = b.pending.get(msg.id)!
        b.pending.delete(msg.id)
        if (msg.error) p.reject(new Error(JSON.stringify(msg.error)))
        else p.resolve(msg.result)
        return
      }
      if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params?.exceptionDetails as {
          text?: string
          exception?: { description?: string }
        }
        b.errors.push((d.exception?.description ?? d.text ?? "exception").slice(0, 300))
      }
      for (const l of b.listeners) l(msg)
    }
    await b.send("Page.enable")
    await b.send("Runtime.enable")
    return b
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.seq
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  private once(method: string, timeout = 60_000): Promise<unknown> {
    return new Promise((resolve) => {
      const f = (m: Message) => {
        if (m.method === method) {
          clearTimeout(t)
          this.listeners.delete(f)
          resolve(m.params)
        }
      }
      const t = setTimeout(() => {
        this.listeners.delete(f)
        resolve(null)
      }, timeout)
      this.listeners.add(f)
    })
  }

  async evaluate<T>(expression: string): Promise<T> {
    const r = (await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })) as {
      result: { value: T }
    }
    return r.result.value
  }

  async viewport(width: number, height: number, mobile = false): Promise<void> {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: mobile ? 2 : 1,
      mobile,
    })
    // maxTouchPoints must be 1-16 when given: only send it to turn touch on
    await this.send(
      "Emulation.setTouchEmulationEnabled",
      mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false },
    )
  }

  async goto(url: string): Promise<void> {
    const loaded = this.once("Page.loadEventFired")
    await this.send("Page.navigate", { url })
    await loaded
  }

  async waitFor(expression: string, timeout = 180_000): Promise<boolean> {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      if (await this.evaluate<boolean>(expression)) return true
      await sleep(300)
    }
    return false
  }

  async click(x: number, y: number): Promise<void> {
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
      await this.send("Input.dispatchMouseEvent", {
        type,
        x,
        y,
        button: type === "mouseMoved" ? "none" : "left",
        clickCount: 1,
      })
    }
  }

  /** Clicks the element matching a CSS selector; false when there is none. */
  async clickOn(selector: string): Promise<boolean> {
    const at = await this.evaluate<[number, number] | null>(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return [r.x + r.width / 2, r.y + r.height / 2];
    })()`)
    if (!at) return false
    await this.click(at[0], at[1])
    return true
  }

  async screenshot(file: string): Promise<void> {
    // .jpg: light enough to be versioned with the club's history
    const jpeg = /\.jpe?g$/i.test(file)
    const r = (await this.send(
      "Page.captureScreenshot",
      jpeg ? { format: "jpeg", quality: 85 } : { format: "png" },
    )) as { data: string }
    writeFileSync(file, Buffer.from(r.data, "base64"))
  }

  static sleep = sleep

  close(): void {
    this.ws.close()
  }
}
