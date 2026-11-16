import AppKit
import PlaygroundCore
import UniformTypeIdentifiers
import WebKit

/// The one playground window: a frosted background (int-ai-m's recipe), the web app above it, the bridge to the
/// page, and the file commands.
@MainActor
final class PlaygroundWindowController: NSWindowController, NSWindowDelegate {
    let webView: WKWebView
    let schemeHandler: AppSchemeHandler
    private let effect = NSVisualEffectView()
    private let recent: RecentFiles
    private var bridge: PageBridge!
    private var navigation: NavigationPolicy!
    private(set) var pageReady = false
    private var readyWaiters: [CheckedContinuation<Void, Never>] = []
    private var reduceTransparencyObserver: NSObjectProtocol?

    /// The file Save writes to. Access to a file chosen in an earlier launch lasts while it is the current file.
    private(set) var fileURL: URL? {
        didSet {
            if oldValue != fileURL { oldValue?.stopAccessingSecurityScopedResource() }
            window?.title = fileURL?.lastPathComponent ?? MainMenu.appName
            window?.representedURL = fileURL
        }
    }

    static let transparencyKey = "backgroundTransparency"

    var transparency: Double {
        get { UserDefaults.standard.object(forKey: Self.transparencyKey) as? Double ?? Glass.defaultTransparency }
        set {
            UserDefaults.standard.set(newValue, forKey: Self.transparencyKey)
            applyGlass()
        }
    }

    init(webRoot: URL, recent: RecentFiles) {
        self.recent = recent
        schemeHandler = AppSchemeHandler(bundle: WebBundle(root: webRoot))
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(schemeHandler, forURLScheme: WebBundle.scheme)
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isInspectable = true
        webView.setValue(false, forKey: "drawsBackground")

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = MainMenu.appName
        window.titlebarAppearsTransparent = true
        window.isOpaque = false
        window.backgroundColor = .clear
        window.minSize = NSSize(width: 900, height: 600)
        window.tabbingMode = .disallowed
        super.init(window: window)
        window.delegate = self

        bridge = PageBridge(controller: self)
        configuration.userContentController.add(bridge, name: HostProtocol.messageHandlerName)
        navigation = NavigationPolicy()
        webView.navigationDelegate = navigation
        webView.uiDelegate = navigation
        Self.blockWebLoads(in: configuration.userContentController)

        layOut(in: window)
        window.setFrameAutosaveName("PlaygroundWindow")
        if !window.setFrameUsingName("PlaygroundWindow") { window.center() }
        reduceTransparencyObserver = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.accessibilityDisplayOptionsDidChangeNotification, object: nil, queue: .main
        ) { [weak self] _ in MainActor.assumeIsolated { self?.applyGlass() } }
        applyGlass()
    }

    required init?(coder: NSCoder) { nil }

    func loadApp(_ url: URL = WebBundle.origin) {
        pageReady = false
        webView.load(URLRequest(url: url))
    }

    // MARK: Layout and glass

    /// The blur fills the whole window, title bar included; the page starts below the title bar.
    private func layOut(in window: NSWindow) {
        let container = NSView()
        effect.blendingMode = .behindWindow
        effect.material = .menu
        effect.state = .active
        for view in [effect, webView] as [NSView] {
            view.translatesAutoresizingMaskIntoConstraints = false
            container.addSubview(view)
        }
        window.contentView = container
        NSLayoutConstraint.activate([
            effect.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            effect.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            effect.topAnchor.constraint(equalTo: container.topAnchor),
            effect.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
        if let guide = window.contentLayoutGuide as? NSLayoutGuide {
            webView.topAnchor.constraint(equalTo: guide.topAnchor).isActive = true
        }
    }

    /// The slider moves only the blur and the page colour behind the content.
    func applyGlass() {
        let reduce = NSWorkspace.shared.accessibilityDisplayShouldReduceTransparency
        let look = Glass.appearance(transparency: transparency, reduceTransparency: reduce)
        effect.isHidden = reduce
        effect.alphaValue = look.blur
        window?.backgroundColor = reduce ? .windowBackgroundColor : .clear
        if pageReady { send(.setGlass(tint: look.tint)) }
    }

    /// No page or worker in this window may fetch from the web; links open in the default browser instead.
    private static func blockWebLoads(in controller: WKUserContentController) {
        let rules = #"[{"trigger":{"url-filter":"^https?://"},"action":{"type":"block"}}]"#
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "block-web-loads", encodedContentRuleList: rules) { list, error in
            if let list {
                controller.add(list)
            } else if let error {
                FileHandle.standardError.write(Data("Blocking web loads failed: \(error)\n".utf8))
            }
        }
    }

    // MARK: Bridge

    func pageDidBecomeReady() {
        pageReady = true
        applyGlass()
        readyWaiters.forEach { $0.resume() }
        readyWaiters = []
    }

    func pageThemeChanged(dark: Bool) {
        window?.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
    }

    func waitUntilPageReady() async {
        if pageReady { return }
        await withCheckedContinuation { readyWaiters.append($0) }
    }

    @discardableResult
    func send(_ command: HostCommand) async throws -> HostReply? {
        let value = try await webView.callAsyncJavaScript(
            "return window.playgroundHost ? window.playgroundHost.handle(command) : null",
            arguments: ["command": command.payload],
            contentWorld: .page
        )
        return HostReply(value)
    }

    func send(_ command: HostCommand) {
        Task { try? await send(command) }
    }

    // MARK: Commands

    @objc func runCode(_ sender: Any?) { send(.run) }
    @objc func stopCode(_ sender: Any?) { send(.stop) }

    @objc func openDocument(_ sender: Any?) {
        guard let window else { return }
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.pythonScript, .plainText]
        panel.allowsMultipleSelection = false
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            MainActor.assumeIsolated { self?.open(url) }
        }
    }

    func open(_ url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        do {
            let code = try PythonFile.text(from: Data(contentsOf: url))
            Task {
                await waitUntilPageReady()
                guard (try? await send(.openFile(name: url.lastPathComponent, code: code)))?.ok == true else {
                    showProblem("Could not open “\(url.lastPathComponent)”.", "The playground did not accept the file.")
                    return
                }
                fileURL = url
                recent.add(url)
            }
        } catch {
            if scoped { url.stopAccessingSecurityScopedResource() }
            let reason = switch error as? PythonFile.ReadError {
            case .tooLarge: "The file is longer than the playground can hold (80,000 characters)."
            case .notText: "The file is not UTF-8 text."
            case nil: error.localizedDescription
            }
            showProblem("Could not open “\(url.lastPathComponent)”.", reason)
        }
    }

    @objc func saveDocument(_ sender: Any?) {
        guard let fileURL else { return saveDocumentAs(sender) }
        Task { await write(to: fileURL) }
    }

    @objc func saveDocumentAs(_ sender: Any?) {
        guard let window else { return }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.pythonScript]
        panel.nameFieldStringValue = fileURL?.lastPathComponent ?? PythonFile.untitledName
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            MainActor.assumeIsolated {
                guard let self else { return }
                Task {
                    if await self.write(to: url) { self.fileURL = url }
                }
            }
        }
    }

    @discardableResult
    func write(to url: URL) async -> Bool {
        do {
            guard let code = try await send(.getCode)?.code else {
                showProblem("Could not save.", "The playground did not return its code.")
                return false
            }
            try Data(code.utf8).write(to: url)
            recent.add(url)
            return true
        } catch {
            showProblem("Could not save “\(url.lastPathComponent)”.", error.localizedDescription)
            return false
        }
    }

    /// The last problem shown to the learner, for the self-test report.
    private(set) var lastProblem: String?

    private func showProblem(_ message: String, _ detail: String) {
        lastProblem = "\(message) \(detail)"
        let alert = NSAlert()
        alert.messageText = message
        alert.informativeText = detail
        if let window { alert.beginSheetModal(for: window) } else { alert.runModal() }
    }
}

/// Receives the page's `HostEvent`s. Kept apart from the controller so the content controller does not retain it.
@MainActor
final class PageBridge: NSObject, WKScriptMessageHandler {
    private weak var controller: PlaygroundWindowController?

    init(controller: PlaygroundWindowController) {
        self.controller = controller
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.protocol == WebBundle.scheme,
              let event = HostEvent(message: message.body) else { return }
        switch event {
        case let .ready(version) where version == HostProtocol.version:
            controller?.pageDidBecomeReady()
        case .ready:
            FileHandle.standardError.write(Data("The page speaks a different host protocol version.\n".utf8))
        case let .theme(dark):
            controller?.pageThemeChanged(dark: dark)
        }
    }
}

/// Applies `LinkPolicy` to every navigation and new-window request, and saves downloads where the learner chooses.
@MainActor
final class NavigationPolicy: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        if action.shouldPerformDownload { return .download }
        switch LinkPolicy.decide(action.request.url) {
        case .allow:
            return .allow
        case .openExternally:
            if let url = action.request.url { NSWorkspace.shared.open(url) }
            return .cancel
        case .refuse:
            return .cancel
        }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(
        _ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
        for action: WKNavigationAction, windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if LinkPolicy.decide(action.request.url) == .openExternally, let url = action.request.url {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String) async -> URL? {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        return panel.runModal() == .OK ? panel.url : nil
    }
}
