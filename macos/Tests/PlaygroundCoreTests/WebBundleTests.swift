import Foundation
import Testing
@testable import PlaygroundCore

@Suite struct WebBundleTests {
    let root: URL
    let bundle: WebBundle

    init() throws {
        root = FileManager.default.temporaryDirectory.appending(path: "webbundle-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root.appending(path: "assets"), withIntermediateDirectories: true)
        try Data("<html></html>".utf8).write(to: root.appending(path: "index.html"))
        try Data("self.x = 1".utf8).write(to: root.appending(path: "assets/python.worker-Ab12.js"))
        try Data("console.log(1)".utf8).write(to: root.appending(path: "assets/index-Cd34.js"))
        try Data([0, 97, 115, 109]).write(to: root.appending(path: "assets/pyodide.asm.wasm"))
        bundle = WebBundle(root: root)
    }

    @Test func servesIndexForTheRoot() {
        let response = bundle.response(for: URL(string: "app://local/?lesson=playground#plp=x")!)
        #expect(response.status == 200)
        #expect(response.headers["Content-Type"] == "text/html; charset=utf-8")
    }

    @Test func givesWasmItsOwnTypeForStreamingCompile() {
        #expect(bundle.response(for: URL(string: "app://local/assets/pyodide.asm.wasm")!).headers["Content-Type"] == "application/wasm")
    }

    @Test func locksDownOnlyThePythonWorker() {
        let worker = bundle.response(for: URL(string: "app://local/assets/python.worker-Ab12.js")!)
        #expect(worker.headers["Content-Security-Policy"] == WebBundle.pythonWorkerCSP)
        #expect(!WebBundle.pythonWorkerCSP.contains("http"))
        let page = bundle.response(for: URL(string: "app://local/assets/index-Cd34.js")!)
        #expect(page.headers["Content-Security-Policy"] == nil)
    }

    @Test func refusesPathsOutsideTheBundle() {
        #expect(bundle.fileURL(for: URL(string: "app://local/../../etc/passwd")!) == nil)
        #expect(bundle.fileURL(for: URL(string: "app://local/%2e%2e/%2e%2e/etc/passwd")!) == nil)
        #expect(bundle.response(for: URL(string: "app://local/assets/../../secret")!).status == 404)
    }

    @Test func refusesOtherSchemesHostsAndFolders() {
        #expect(bundle.fileURL(for: URL(string: "file:///etc/passwd")!) == nil)
        #expect(bundle.fileURL(for: URL(string: "app://other/index.html")!) == nil)
        #expect(bundle.response(for: URL(string: "app://local/assets")!).status == 404)
        #expect(bundle.response(for: URL(string: "app://local/missing.js")!).status == 404)
    }
}
