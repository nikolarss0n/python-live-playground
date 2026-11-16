import AppKit
import PlaygroundCore
import SwiftUI
import WebKit

/// Owns the one web view for a window and the handler that serves the bundled app into it.
@MainActor
final class PlaygroundPage {
    let webView: WKWebView
    let handler: AppSchemeHandler

    init(webRoot: URL, blockNetwork: Bool) {
        handler = AppSchemeHandler(bundle: WebBundle(root: webRoot))
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(handler, forURLScheme: WebBundle.scheme)
        configuration.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isInspectable = true
        webView.setValue(false, forKey: "drawsBackground")
        if blockNetwork {
            Self.installNetworkBlock(into: configuration.userContentController)
        }
    }

    func load(_ url: URL = WebBundle.origin) {
        webView.load(URLRequest(url: url))
    }

    /// The self-test proves offline behaviour by refusing every http(s) load, page and worker alike.
    private static func installNetworkBlock(into controller: WKUserContentController) {
        let rules = #"[{"trigger":{"url-filter":"^https?://"},"action":{"type":"block"}}]"#
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "block-network", encodedContentRuleList: rules) { list, error in
            if let list {
                controller.add(list)
            } else if let error {
                FileHandle.standardError.write(Data("Network block failed: \(error)\n".utf8))
            }
        }
    }
}

struct PlaygroundWebView: NSViewRepresentable {
    let page: PlaygroundPage

    func makeNSView(context: Context) -> WKWebView { page.webView }
    func updateNSView(_ nsView: WKWebView, context: Context) {}
}
