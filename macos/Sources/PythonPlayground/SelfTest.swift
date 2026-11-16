import AppKit
import Foundation
import PlaygroundCore
import WebKit

/// `--self-test`: the spike's go/no-go. With http(s) blocked, load the bundled app, run Python, stop an endless
/// loop, run again on the replacement worker, print a JSON report and exit 0 on success.
/// Launch it with `open` (see `npm run test:mac`): a window behind other apps is reported hidden, and WebKit then
/// slows timers and skips CodeMirror's layout passes, which skews the timings and the gutter check.
@MainActor
struct SelfTest {
    let page: PlaygroundPage

    private static let script = #"""
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const until = async (check, ms, what) => {
      const end = Date.now() + ms
      while (Date.now() < end) { const value = check(); if (value) return value; await wait(100) }
      throw new Error('Timed out waiting for ' + what + '. Results: ' + results().slice(0, 300))
    }
    const results = () => document.querySelector('.results-panel')?.innerText ?? ''
    const status = () => document.querySelector('.status-label')?.className ?? ''
    const key = (init) => window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
    const run = () => key({ key: 'Enter', metaKey: true })
    const setCode = (code) => {
      const content = document.querySelector('.cm-content')
      content.focus()
      document.execCommand('selectAll')
      document.execCommand('insertText', false, code)
      const text = content.innerText.replace(/\u00a0/g, ' ')
      if (!text.includes(code.split('\n')[0])) throw new Error('Editor did not take the code. Editor: ' + text.slice(0, 200))
    }
    const report = {}
    await until(() => document.querySelector('.cm-content'), 20000, 'the editor')
    let started = performance.now()
    setCode('print("hello from the Mac app")\nprint(sum(range(10)))')
    run()
    await until(() => results().includes('hello from the Mac app') && results().includes('45'), 90000, 'the first run')
    report.firstRunMs = Math.round(performance.now() - started)

    setCode('while True:\n    pass')
    run()
    await until(() => status().includes('running'), 10000, 'the loop to start')
    await wait(300)
    started = performance.now()
    key({ key: 'Escape' })
    await until(() => !status().includes('running'), 5000, 'Stop')
    report.stopMs = Math.round(performance.now() - started)
    report.statusAfterStop = status().replace('status-label status-label-', '')
    if (report.statusAfterStop !== 'stopped') throw new Error('Stop ended in ' + report.statusAfterStop)

    setCode('print("after stop")')
    started = performance.now()
    run()
    await until(() => results().includes('after stop'), 60000, 'a run on the new worker')
    report.runAfterStopMs = Math.round(performance.now() - started)
    const top = (selector) => Math.round(document.querySelector(selector)?.getBoundingClientRect().top ?? -1)
    // Line numbers can only be checked once the window is on screen; a covered window gets no layout passes.
    const shown = await until(() => document.visibilityState === 'visible', 5000, 'the window').catch(() => false)
    if (shown) {
      await wait(300)
      report.lineNumberOffsetPx = [...document.querySelectorAll('.cm-lineNumbers .cm-gutterElement')]
        .filter((element) => element.textContent === '1').map((element) => Math.round(element.getBoundingClientRect().top) - top('.cm-line'))[0] ?? null
      if (report.lineNumberOffsetPx !== 0) throw new Error('Line number 1 is ' + report.lineNumberOffsetPx + 'px off its code line')
    } else {
      report.lineNumberOffsetPx = 'not checked: the window stayed covered'
    }
    report.crossOriginIsolated = self.crossOriginIsolated
    report.secureContext = self.isSecureContext
    report.origin = location.origin
    return JSON.stringify(report)
    """#

    func runAndExit() async {
        page.load(URL(string: "app://local/?lesson=playground")!)
        NSApp.activate()
        page.webView.window?.makeKeyAndOrderFront(nil)
        var exitCode: Int32 = 1
        var output: [String: Any] = [:]
        do {
            try await waitForPage()
            page.webView.window?.makeKeyAndOrderFront(nil)
            let value = try await page.webView.callAsyncJavaScript(Self.script, contentWorld: .page)
            if let json = value as? String, let data = json.data(using: .utf8),
               let report = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                output = report
                exitCode = 0
            }
            output["screenshot"] = await saveScreenshot()
        } catch {
            output["error"] = "\(error)"
        }
        let served = page.handler.served
        output["servedCount"] = served.count
        output["windows"] = NSApp.windows.map { "\($0.className) visible=\($0.isVisible) hasWebView=\(page.webView.window === $0)" }
        output["pyodideFromBundle"] = served.filter { $0.contains("/pyodide/") }
        output["notFound"] = served.filter { $0.hasPrefix("404") }
        let data = (try? JSONSerialization.data(withJSONObject: output, options: [.prettyPrinted, .sortedKeys])) ?? Data()
        print(String(decoding: data, as: UTF8.self))
        print(exitCode == 0 ? "SELF-TEST: PASS" : "SELF-TEST: FAIL")
        exit(exitCode)
    }

    /// Saves what the window shows after the runs, for a visual check. The sandbox allows only its own temp folder.
    private func saveScreenshot() async -> String? {
        guard let image = try? await page.webView.takeSnapshot(configuration: nil),
              let tiff = image.tiffRepresentation,
              let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:])
        else { return nil }
        let url = FileManager.default.temporaryDirectory.appending(path: "self-test.png")
        return (try? png.write(to: url)) == nil ? nil : url.path
    }

    private func waitForPage() async throws {
        for _ in 0..<200 {
            try await Task.sleep(for: .milliseconds(100))
            let ready = try? await page.webView.evaluateJavaScript("location.origin === 'app://local' && document.readyState === 'complete'")
            if ready as? Bool == true { return }
        }
        throw URLError(.timedOut)
    }
}
