import Foundation
import PlaygroundCore
import WebKit

/// Answers `app://local/...` from the bundled web folder. Every request is recorded so the self-test can show
/// that Pyodide came from the app, not the network.
@MainActor
final class AppSchemeHandler: NSObject, WKURLSchemeHandler {
    private let bundle: WebBundle
    private(set) var served: [String] = []

    init(bundle: WebBundle) {
        self.bundle = bundle
    }

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        guard let url = task.request.url else {
            task.didFailWithError(URLError(.badURL))
            return
        }
        let response = bundle.response(for: url)
        served.append("\(response.status) \(url.path)")
        guard let http = HTTPURLResponse(url: url, statusCode: response.status, httpVersion: "HTTP/1.1", headerFields: response.headers) else {
            task.didFailWithError(URLError(.cannotParseResponse))
            return
        }
        task.didReceive(http)
        task.didReceive(response.data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}
}
