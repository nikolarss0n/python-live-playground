import AppKit
import Foundation
import PlaygroundCore
import WebKit

/// `--self-test`: drives the app the way the menus do. With web loads blocked it opens a `.py` file, runs it, stops
/// an endless loop, runs again on the new worker, saves to disk, moves the Background Transparency slider and checks
/// the editor layout. It prints a JSON report and exits 0 only if every step passed.
///
/// Launch it with `open` (see `npm run test:mac`): a window behind other apps is reported hidden, and WebKit then
/// slows timers and skips CodeMirror's layout passes, which skews the timings and the gutter check.
@MainActor
struct SelfTest {
    let controller: PlaygroundWindowController
    private var webView: WKWebView { controller.webView }

    private static let helpers = #"""
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const results = () => document.querySelector('.results-panel')?.innerText ?? ''
    const editor = () => (document.querySelector('.cm-content')?.innerText ?? '').replace(/ /g, ' ')
    window.__selfTest = {
      wait,
      results,
      editor,
      status: () => (document.querySelector('.status-label')?.className ?? '').replace('status-label status-label-', ''),
      async until(check, ms, what) {
        const end = Date.now() + ms
        while (Date.now() < end) { const value = check(); if (value) return value; await wait(100) }
        throw new Error('Timed out waiting for ' + what + '. Results: ' + results().slice(0, 300))
      },
      setCode(code) {
        const content = document.querySelector('.cm-content')
        content.focus()
        document.execCommand('selectAll')
        document.execCommand('insertText', false, code)
        if (!editor().includes(code.split('\n')[0])) throw new Error('Editor did not take the code. Editor: ' + editor().slice(0, 200))
      },
    }
    return true
    """#

    func runAndExit() async {
        var report: [String: Any] = [:]
        var failure: String?
        let savedTransparency = controller.transparency
        do {
            try await run(into: &report)
        } catch {
            failure = "\(error)"
        }
        controller.transparency = savedTransparency
        if let failure { report["error"] = failure }
        report["notFound"] = controller.schemeHandler.served.filter { $0.hasPrefix("404") }
        report["pyodideFilesFromBundle"] = controller.schemeHandler.served.filter { $0.contains("/pyodide/") }.count
        let data = (try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])) ?? Data()
        print(String(decoding: data, as: UTF8.self))
        print(failure == nil ? "SELF-TEST: PASS" : "SELF-TEST: FAIL")
        exit(failure == nil ? 0 : 1)
    }

    private func run(into report: inout [String: Any]) async throws {
        let folder = FileManager.default.temporaryDirectory.appending(path: "self-test-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }

        controller.loadApp(URL(string: "app://local/?lesson=intro")!)
        try await within(seconds: 20, "the page to say it is ready") { await controller.waitUntilPageReady() }
        report["launchToReadyMs"] = ms(since: launchedAt)
        _ = try await js(Self.helpers)
        _ = try await js("await __selfTest.until(() => document.querySelector('.cm-content'), 20000, 'the editor')")
        report["launchToEditorMs"] = ms(since: launchedAt)

        // File › Open lands the file in free play, and Run › Run runs it.
        let opened = folder.appending(path: "grade.py")
        try Data("score = 95\nprint(\"Grade:\", \"A\" if score >= 90 else \"B\")\n".utf8).write(to: opened)
        controller.open(opened)
        try await within(seconds: 10, "the opened file") {
            while controller.window?.title != "grade.py" { try await Task.sleep(for: .milliseconds(100)) }
        }
        _ = try await js("await __selfTest.until(() => __selfTest.editor().includes('score = 95'), 5000, 'the file in the editor')")
        report["openedLesson"] = try await js("return document.querySelector('select')?.selectedOptions?.[0]?.textContent ?? null")
        var started = Date()
        try await controller.send(.run)
        _ = try await js("await __selfTest.until(() => __selfTest.results().includes('Grade: A'), 90000, 'the first run')")
        report["firstRunMs"] = ms(since: started)

        // Run › Stop ends an endless loop, and the next run gets a fresh worker.
        _ = try await js("__selfTest.setCode('while True:\\n    pass')")
        try await controller.send(.run)
        // Typing also starts an automatic run, which replaces the worker once; wait until the loop has run steadily.
        _ = try await js("""
          let since = 0
          await __selfTest.until(() => {
            if (__selfTest.status() !== 'running') { since = 0; return false }
            since ||= Date.now()
            return Date.now() - since > 400
          }, 10000, 'the loop to run steadily')
        """)
        started = Date()
        try await controller.send(.stop)
        report["statusAfterStop"] = try await js("return await __selfTest.until(() => __selfTest.status() !== 'running' && __selfTest.status(), 5000, 'Stop')")
        report["stopMs"] = ms(since: started)
        guard report["statusAfterStop"] as? String == "stopped" else { throw Failure("Stop ended in \(report["statusAfterStop"] ?? "nothing")") }
        _ = try await js("__selfTest.setCode('print(\"after stop\")')")
        started = Date()
        try await controller.send(.run)
        _ = try await js("await __selfTest.until(() => __selfTest.results().includes('after stop'), 60000, 'a run on the new worker')")
        report["runAfterStopMs"] = ms(since: started)

        // File › Save writes the editor's code to the opened file.
        _ = try await js("__selfTest.setCode('print(\"saved from the app\")')")
        guard controller.fileURL == opened.standardizedFileURL || controller.fileURL == opened else {
            throw Failure("Save would not write to the opened file: \(controller.fileURL?.path ?? "none")")
        }
        guard await controller.write(to: opened) else { throw Failure("Save failed: \(controller.lastProblem ?? "no message")") }
        let saved = try String(contentsOf: opened, encoding: .utf8)
        guard saved.contains("saved from the app") else { throw Failure("The file holds: \(saved.prefix(80))") }
        report["savedToDisk"] = true

        // The slider thins the page colour over the blur; text keeps its colour.
        controller.transparency = 0.5
        try await Task.sleep(for: .milliseconds(300))
        let glass = try await js("""
          const root = document.documentElement
          const alpha = (color) => { const m = /\\(([^)]+)\\)/.exec(color); const parts = m ? m[1].split(/[ ,\\/]+/).filter(Boolean) : []; return parts.length > 3 ? Number(parts[parts.length - 1]) : 1 }
          return { host: root.dataset.host ?? null, tint: root.style.getPropertyValue('--glass-tint'), pageColor: getComputedStyle(root).backgroundColor,
            paneAlpha: alpha(getComputedStyle(document.querySelector('.pane')).backgroundColor),
            toolbarAlpha: alpha(getComputedStyle(document.querySelector('.toolbar')).backgroundColor),
            pageAlpha: alpha(getComputedStyle(root).backgroundColor), textAlpha: alpha(getComputedStyle(document.querySelector('.cm-line')).color) }
        """) as? [String: Any] ?? [:]
        report["glass"] = glass
        guard glass["host"] as? String == "mac", let pageAlpha = glass["pageAlpha"] as? Double, pageAlpha < 1,
              (glass["paneAlpha"] as? Double ?? 1) == 0, (glass["toolbarAlpha"] as? Double ?? 1) < 0.82,
              glass["textAlpha"] as? Double == 1 else { throw Failure("The slider did not thin the page: \(glass)") }

        // Nothing in the page reaches the web.
        report["webFetchBlocked"] = try await js("try { await fetch('https://example.com/'); return false } catch { return true }") as? Bool
        guard report["webFetchBlocked"] as? Bool == true else { throw Failure("The page reached the web") }

        report["lineNumberOffsetPx"] = try await js("""
          const shown = await __selfTest.until(() => document.visibilityState === 'visible', 5000, 'the window').catch(() => false)
          if (!shown) return 'not checked: the window stayed covered'
          await __selfTest.wait(300)
          const line = Math.round(document.querySelector('.cm-line').getBoundingClientRect().top)
          const number = [...document.querySelectorAll('.cm-lineNumbers .cm-gutterElement')].find((element) => element.textContent === '1')
          return number ? Math.round(number.getBoundingClientRect().top) - line : null
        """)
        if let offset = report["lineNumberOffsetPx"] as? Int, offset != 0 { throw Failure("Line number 1 is \(offset)px off its code line") }
        report["screenshot"] = await saveScreenshot()

        // A file with FastAPI routes lists them in the API tab, each with its request ready to send.
        _ = try await js("""
            __selfTest.setCode('from fastapi import FastAPI\\napp = FastAPI()\\n\\n@app.get("/hello")\\ndef hello(name: str = "Ada", times: int = 1):\\n    return {"hello": name, "share": 10 / times}')
            const tab = await __selfTest.until(() => document.getElementById('fullstack-tab-api'), 5000, 'the API tab')
            tab.click()
            const route = await __selfTest.until(() => document.querySelector('[aria-label="Routes"] .api-route'), 20000, 'the route list')
            if (!route.textContent.includes('/hello')) throw new Error('Routes list shows: ' + route.textContent)
            const name = document.querySelector('.api-pair-value')
            if (name?.value !== 'Ada') throw new Error('The query default was not prepared: ' + name?.value)
            const send = await __selfTest.until(() => [...document.querySelectorAll('.api-request button')].find((button) => button.textContent === 'Send' && !button.disabled), 20000, 'Send')
            send.click()
            await __selfTest.until(() => document.querySelector('.api-response')?.textContent.includes("'Ada'"), 10000, 'the response to the prepared request')
            """)
        report["apiRequestSent"] = true

        // A refused request marks the field it names; a crashed handler links to the line that raised.
        _ = try await js("""
            const times = [...document.querySelectorAll('.api-pair')].find((pair) => pair.textContent.startsWith('times')).querySelector('input')
            const type = (value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(times, value); times.dispatchEvent(new Event('input', { bubbles: true })) }
            const send = async () => (await __selfTest.until(() => [...document.querySelectorAll('.api-request button')].find((button) => button.textContent === 'Send' && !button.disabled), 20000, 'Send')).click()
            type('often')
            await send()
            const refused = await __selfTest.until(() => document.querySelector('.api-refusals'), 10000, 'the refused field')
            if (!refused.textContent.startsWith('times') || times.getAttribute('aria-invalid') !== 'true') throw new Error('The refused field was not marked: ' + refused.textContent)
            type('0')
            await send()
            const link = await __selfTest.until(() => document.querySelector('.api-response-line'), 10000, 'the crash line link')
            if (link.textContent !== 'Crashed on line 6') throw new Error('The crash link reads: ' + link.textContent)
            link.click()
            await __selfTest.until(() => document.querySelector('.cm-activeLine')?.textContent.includes('10 / times'), 5000, 'the editor on the crashed line')
            document.getElementById('fullstack-tab-results').click()
            """)
        report["apiRefusalAndCrashLine"] = true

        // Entering a local project keeps the last native file safe from a subsequent File › Save.
        _ = try await js("""
            document.querySelector('[aria-label="Open projects"]').click()
            await __selfTest.until(() => __selfTest.results().includes('m*****@example.com'), 20000, 'the multi-file project')
            for (const divider of document.querySelectorAll('.project-workspace [role="separator"]')) {
              const panel = document.getElementById(divider.getAttribute('aria-controls'))
              const before = panel.getBoundingClientRect().width
              divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
              await __selfTest.until(() => panel.getBoundingClientRect().width > before + 1, 2000, 'resize ' + panel.id)
            }
            if (document.querySelectorAll('.project-workspace [role="separator"]').length !== 2) throw new Error('Missing project dividers')
            const tree = document.querySelector('.project-explorer .project-tree-content')
            for (const selector of ['button[title="data"]', 'button[title="main.py"]', '.project-tree']) {
              const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })
              if (tree.querySelector(selector).dispatchEvent(event)) throw new Error('WebKit menu on ' + selector)
              await __selfTest.until(() => tree.querySelector('[role="menu"]'), 2000, 'the Explorer context menu')
              tree.querySelector('[role="menuitem"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
              await __selfTest.until(() => !tree.querySelector('[role="menu"]'), 2000, 'dismiss the Explorer context menu')
            }
            const picker = document.querySelector('select[aria-label="Project"]')
            picker.value = 'patterns'
            picker.dispatchEvent(new Event('change', { bubbles: true }))
            await __selfTest.until(() => document.querySelector('.pattern-review')?.textContent.includes('Local syntax review'), 10000, 'offline design pattern review')
            document.querySelector('[aria-label="Close pattern review"]').click()
            await __selfTest.until(() => !document.querySelector('.pattern-review'), 2000, 'close the review')
            const paneBackground = getComputedStyle(document.querySelector('.pane-editor')).backgroundColor
            for (const selector of ['.project-toolbar', '.project-explorer', '.project-file-bar', '.pane-results', '.app-footer']) {
              if (getComputedStyle(document.querySelector(selector)).backgroundColor !== paneBackground) {
                throw new Error(selector + ' covers the shared project window backdrop')
              }
            }
            """)
        guard let project = try await controller.send(.getCode)?.projectDocument, project.saved, project.name == "mask.py" else {
            throw Failure("Project file was not identified for native Save")
        }
        controller.saveDocument(nil)
        try await Task.sleep(for: .milliseconds(300))
        guard try String(contentsOf: opened, encoding: .utf8) == saved else { throw Failure("Project Save changed the scratchpad file") }
        controller.open(opened)
        _ = try await js("await __selfTest.until(() => __selfTest.editor().includes('saved from the app'), 5000, 'native Open from project mode')")
        report["projectRunAndSave"] = true
    }

    private func js(_ body: String) async throws -> Any? {
        try await webView.callAsyncJavaScript(body, contentWorld: .page)
    }

    private func ms(since start: Date) -> Int { Int(Date().timeIntervalSince(start) * 1000) }

    private func within(seconds: Double, _ what: String, _ work: @escaping @MainActor () async throws -> Void) async throws {
        try await withThrowingTaskGroup(of: Void.self) { group in
            group.addTask { try await work() }
            group.addTask {
                try await Task.sleep(for: .seconds(seconds))
                throw Failure("Timed out waiting for \(what)")
            }
            try await group.next()
            group.cancelAll()
        }
    }

    /// What the page shows, for a visual check. The sandbox allows only its own temp folder.
    private func saveScreenshot() async -> String? {
        guard let image = try? await webView.takeSnapshot(configuration: nil),
              let tiff = image.tiffRepresentation,
              let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:])
        else { return nil }
        let url = FileManager.default.temporaryDirectory.appending(path: "self-test.png")
        return (try? png.write(to: url)) == nil ? nil : url.path
    }
}

struct Failure: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}
