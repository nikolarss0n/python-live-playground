import AppKit
import PlaygroundAI
import PlaygroundCore
import UniformTypeIdentifiers
import WebKit

/// The one playground window: a frosted background (int-ai-m's recipe), the web app above it, the bridge to the
/// page, and the file commands.
@MainActor
final class PlaygroundWindowController: NSWindowController, NSWindowDelegate {
    let webView: DropWebView
    let schemeHandler: AppSchemeHandler
    private let effect = NSVisualEffectView()
    private let recent: RecentFiles
    private var bridge: PageBridge!
    private var navigation: NavigationPolicy!
    private(set) var pageReady = false
    private var readyWaiters: [CheckedContinuation<Void, Never>] = []
    private var reduceTransparencyObserver: NSObjectProtocol?
    private let diskWatcher = DiskWatcher()
    private var lastDiskCode: String?
    private var lastDiskProject: DiskProject?
    var bypassUnsavedPrompt = false

    var needsUnsavedConfirmation: Bool {
        !bypassUnsavedPrompt && (window?.isDocumentEdited ?? false)
    }

    /// The file Save writes to. Access to a file chosen in an earlier launch lasts while it is the current file.
    private(set) var fileURL: URL? {
        didSet {
            if oldValue != fileURL { oldValue?.stopAccessingSecurityScopedResource() }
            if fileURL != nil { folderURL = nil }
            updateWindowDocumentHeader()
        }
    }

    /// A local project folder opened with File › Open Folder…. Live disk edits sync into Projects mode.
    private(set) var folderURL: URL? {
        didSet {
            if oldValue != folderURL { oldValue?.stopAccessingSecurityScopedResource() }
            if folderURL != nil { fileURL = nil }
            updateWindowDocumentHeader()
        }
    }

    private func updateWindowDocumentHeader() {
        let active = folderURL ?? fileURL
        window?.title = active?.lastPathComponent ?? MainMenu.appName
        window?.representedURL = active
        if active == nil { window?.isDocumentEdited = false }
    }

    static let transparencyKey = "backgroundTransparency"

    var transparency: Double {
        get { UserDefaults.standard.object(forKey: Self.transparencyKey) as? Double ?? Glass.defaultTransparency }
        set {
            UserDefaults.standard.set(newValue, forKey: Self.transparencyKey)
            applyGlass()
        }
    }

    init(webRoot: URL, recent: RecentFiles, dataStore: WKWebsiteDataStore = .default()) {
        self.recent = recent
        schemeHandler = AppSchemeHandler(bundle: WebBundle(root: webRoot))
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = dataStore
        configuration.setURLSchemeHandler(schemeHandler, forURLScheme: WebBundle.scheme)
        webView = DropWebView(frame: .zero, configuration: configuration)
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
        configuration.userContentController.addScriptMessageHandler(AIBridge(), contentWorld: .page, name: AIBridge.name)
        navigation = NavigationPolicy()
        webView.navigationDelegate = navigation
        webView.uiDelegate = navigation
        webView.onDropURL = { [weak self] url in self?.openDroppedURL(url) }
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

    func pageDirtyChanged(_ dirty: Bool) {
        window?.isDocumentEdited = (fileURL != nil || folderURL != nil) && dirty
    }

    func windowDidBecomeKey(_ notification: Notification) {
        checkDiskChanges(force: false)
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        guard needsUnsavedConfirmation else { return true }
        confirmUnsavedChanges { [weak self, weak sender] shouldClose in
            guard shouldClose, let self, let sender else { return }
            self.bypassUnsavedPrompt = true
            sender.close()
        }
        return false
    }

    /// Prompts to save unsaved disk changes before closing the window or quitting the app.
    func confirmUnsavedChanges(completion: @escaping @MainActor (Bool) -> Void) {
        guard needsUnsavedConfirmation, let window else {
            completion(true)
            return
        }
        let name = (folderURL ?? fileURL)?.lastPathComponent ?? MainMenu.appName
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "Do you want to save the changes made to “\(name)”?"
        alert.informativeText = "Your changes will be lost if you don’t save them."
        alert.addButton(withTitle: "Save")
        alert.addButton(withTitle: "Cancel")
        let discard = alert.addButton(withTitle: "Don’t Save")
        discard.hasDestructiveAction = true
        alert.beginSheetModal(for: window) { [weak self] response in
            MainActor.assumeIsolated {
                guard let self else { completion(false); return }
                switch response {
                case .alertFirstButtonReturn:
                    Task {
                        let saved = await self.saveActiveDiskTarget()
                        completion(saved)
                    }
                case .alertThirdButtonReturn:
                    self.bypassUnsavedPrompt = true
                    completion(true)
                default:
                    completion(false)
                }
            }
        }
    }

    private func saveActiveDiskTarget() async -> Bool {
        guard let document = await currentDocument() else { return false }
        if let project = document.projectDocument, let folderURL, let dirtyFiles = project.dirtyFiles {
            return writeFolder(dirtyFiles, to: folderURL)
        }
        if let fileURL {
            return write(document, to: fileURL)
        }
        return true
    }

    private func openDroppedURL(_ url: URL) {
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir) else { return }
        if isDir.boolValue {
            openFolder(url)
        } else {
            open(url)
        }
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
    @objc func reloadPage(_ sender: Any?) { loadApp(webView.url ?? WebBundle.origin) }
    @objc func findInEditor(_ sender: Any?) { send(.find) }
    @objc func zoomIn(_ sender: Any?) { send(.zoom(direction: "in")) }
    @objc func zoomOut(_ sender: Any?) { send(.zoom(direction: "out")) }
    @objc func zoomReset(_ sender: Any?) { send(.zoom(direction: "reset")) }

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

    @objc func openFolderDialog(_ sender: Any?) {
        guard let window else { return }
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            MainActor.assumeIsolated { self?.openFolder(url) }
        }
    }

    @objc func reloadFromDisk(_ sender: Any?) {
        checkDiskChanges(force: true)
    }

    func open(_ url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        do {
            let code = try PythonFile.text(from: Data(contentsOf: url))
            Task {
                await waitUntilPageReady()
                guard (try? await send(.openFile(name: url.lastPathComponent, code: code)))?.ok == true else {
                    if scoped { url.stopAccessingSecurityScopedResource() }
                    showProblem("Could not open “\(url.lastPathComponent)”.", "The playground did not accept the file.")
                    return
                }
                lastDiskCode = code
                lastDiskProject = nil
                fileURL = url
                window?.isDocumentEdited = false
                recent.add(url)
                armFileWatch(url)
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

    func openFolder(_ url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        do {
            let project = try DiskFolder.read(at: url)
            Task {
                await waitUntilPageReady()
                guard (try? await send(.openFolder(name: project.name, entry: project.entry, folders: project.folders, files: project.files)))?.ok == true else {
                    if scoped { url.stopAccessingSecurityScopedResource() }
                    showProblem("Could not open “\(url.lastPathComponent)”.", "The playground did not accept the folder.")
                    return
                }
                lastDiskProject = project
                lastDiskCode = nil
                folderURL = url
                window?.isDocumentEdited = false
                recent.add(url)
                armFolderWatch(url)
            }
        } catch {
            if scoped { url.stopAccessingSecurityScopedResource() }
            let reason = switch error {
            case .notAFolder: "The chosen item is not a folder."
            case .noPythonFiles: "The folder has no Python (.py) files."
            case .tooManyFiles: "The folder has more than \(DiskFolder.maxFiles) text files."
            case .tooLarge: "The folder's text files exceed 1 million characters."
            case .unsafePath: "The folder contains an unsupported file path."
            }
            showProblem("Could not open “\(url.lastPathComponent)”.", reason)
        }
    }

    private func armFileWatch(_ url: URL) {
        diskWatcher.watchFile(url) { [weak self] in
            self?.checkDiskChanges(force: false)
        }
    }

    private func armFolderWatch(_ url: URL) {
        diskWatcher.watchFolder(url) { [weak self] in
            self?.checkDiskChanges(force: false)
        }
    }

    /// Re-reads the currently open file or folder from disk and updates the playground when disk contents changed.
    /// With `force == false`, unsaved local edits are preserved rather than silently overwritten.
    func checkDiskChanges(force: Bool) {
        if let folderURL {
            guard let project = try? DiskFolder.read(at: folderURL) else { return }
            if !force && project == lastDiskProject { return }
            let foldersChanged = project.folders != lastDiskProject?.folders
            lastDiskProject = project
            if foldersChanged { armFolderWatch(folderURL) }
            Task {
                _ = try? await send(.syncFolder(
                    name: project.name, entry: project.entry, folders: project.folders, files: project.files, force: force
                ))
                if force { window?.isDocumentEdited = false }
            }
            return
        }
        if let fileURL {
            guard let data = try? Data(contentsOf: fileURL),
                  let code = try? PythonFile.text(from: data) else { return }
            if !force && code == lastDiskCode { return }
            if !force && window?.isDocumentEdited == true {
                lastDiskCode = code
                send(.fileConflict(name: fileURL.lastPathComponent))
                return
            }
            lastDiskCode = code
            Task {
                _ = try? await send(.openFile(name: fileURL.lastPathComponent, code: code))
                window?.isDocumentEdited = false
            }
        }
    }

    @objc func saveDocument(_ sender: Any?) {
        Task {
            guard let document = await currentDocument() else { return }
            if let project = document.projectDocument {
                if let folderURL, let dirtyFiles = project.dirtyFiles {
                    writeFolder(dirtyFiles, to: folderURL)
                } else if !project.saved {
                    showProblem("Project could not be saved.", "See the project status in the playground.")
                }
            } else if let fileURL {
                _ = write(document, to: fileURL)
            } else {
                showSavePanel(for: document)
            }
        }
    }

    @discardableResult
    func writeFolder(_ files: [String: String], to url: URL) -> Bool {
        guard !files.isEmpty else {
            window?.isDocumentEdited = false
            return true
        }
        do {
            try DiskFolder.write(files: files, to: url)
            if let refreshed = try? DiskFolder.read(at: url) { lastDiskProject = refreshed }
            window?.isDocumentEdited = false
            send(.markFolderSaved(files: files))
            return true
        } catch {
            showProblem("Could not save to “\(url.lastPathComponent)”.", error.localizedDescription)
            return false
        }
    }

    func applyDiskMutation(op: String, path: String, newPath: String?) {
        guard let folderURL else { return }
        do {
            switch op {
            case "createFolder":
                try DiskFolder.createFolder(path, in: folderURL)
            case "rename":
                if let newPath { try DiskFolder.rename(from: path, to: newPath, in: folderURL) }
            case "delete":
                try DiskFolder.delete(path, in: folderURL)
            default:
                return
            }
            if let refreshed = try? DiskFolder.read(at: folderURL) {
                let foldersChanged = refreshed.folders != lastDiskProject?.folders
                lastDiskProject = refreshed
                if foldersChanged { armFolderWatch(folderURL) }
            }
        } catch {
            showProblem("Could not update “\(path)” on disk.", error.localizedDescription)
        }
    }

    @objc func saveDocumentAs(_ sender: Any?) {
        Task {
            if let document = await currentDocument() { showSavePanel(for: document) }
        }
    }

    private func showSavePanel(for document: HostReply) {
        guard let window else { return }
        let panel = NSSavePanel()
        if document.projectDocument == nil { panel.allowedContentTypes = [.pythonScript] }
        panel.nameFieldStringValue = document.projectDocument?.name ?? fileURL?.lastPathComponent ?? PythonFile.untitledName
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            MainActor.assumeIsolated {
                guard let self else { return }
                if self.write(document, to: url), document.projectDocument == nil { self.fileURL = url }
            }
        }
    }

    private func currentDocument() async -> HostReply? {
        guard let document = try? await send(.getCode), document.ok, document.code != nil else {
            showProblem("Could not save.", "The playground did not return its code.")
            return nil
        }
        return document
    }

    @discardableResult
    func write(to url: URL) async -> Bool {
        guard let document = await currentDocument(), document.projectDocument == nil else { return false }
        return write(document, to: url)
    }

    private func write(_ document: HostReply, to url: URL) -> Bool {
        guard let code = document.code else { return false }
        do {
            if document.projectDocument == nil { lastDiskCode = code }
            try Data(code.utf8).write(to: url, options: .atomic)
            recent.add(url)
            if document.projectDocument == nil {
                window?.isDocumentEdited = false
                send(.markSaved(code: code))
            }
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
        case let .dirty(edited):
            controller?.pageDirtyChanged(edited)
        case .refreshDisk:
            controller?.reloadFromDisk(nil)
        case let .diskMutation(op, path, newPath):
            controller?.applyDiskMutation(op: op, path: path, newPath: newPath)
        }
    }
}

/// Answers the page's AI checks (`src/host/macAi.ts`) with Apple's on-device model. Only the app's own main frame
/// may ask, and every request is validated before the model sees it.
@MainActor
final class AIBridge: NSObject, WKScriptMessageHandlerWithReply {
    static let name = "playgroundAI"
    /// Off until the on-device model meets the bar in `npm run verify:ai-apple` (2026-11-24: 9/18 pinpoint,
    /// 26/31 goal checks). Turn on for testing with `defaults write dev.local.python-live-playground experimentalOnDeviceAI -bool true`.
    static var enabled: Bool { UserDefaults.standard.bool(forKey: "experimentalOnDeviceAI") }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) async -> (Any?, String?) {
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.protocol == WebBundle.scheme,
              let body = message.body as? [String: Any], let type = body["type"] as? String
        else { return (nil, "Refused") }
        switch type {
        case "availability":
            return (["available": Self.enabled && AppleChoiceModel.unavailableReason() == nil], nil)
        case "answer":
            guard Self.enabled else { return (nil, "AI help is off") }
            do {
                let request = try ChoiceRequest(object: body["request"] as Any)
                return (try await AppleChoiceModel.answer(request).payload, nil)
            } catch {
                return (nil, "\(error)")
            }
        default:
            return (nil, "Unknown request")
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

/// WKWebView subclass that accepts `.py` files and folders dragged from Finder directly onto the window.
@MainActor
final class DropWebView: WKWebView {
    var onDropURL: ((URL) -> Void)?

    override init(frame: CGRect, configuration: WKWebViewConfiguration) {
        super.init(frame: frame, configuration: configuration)
        registerForDraggedTypes([.fileURL])
    }

    required init?(coder: NSCoder) { nil }

    private static func droppedURL(from info: NSDraggingInfo) -> URL? {
        guard let urls = info.draggingPasteboard.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL],
              let url = urls.first else { return nil }
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir) else { return nil }
        if isDir.boolValue { return url }
        let ext = url.pathExtension.lowercased()
        return (ext == "py" || ext == "txt" || ext.isEmpty) ? url : nil
    }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        Self.droppedURL(from: sender) != nil ? .copy : super.draggingEntered(sender)
    }

    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
        Self.droppedURL(from: sender) != nil ? .copy : super.draggingUpdated(sender)
    }

    override func prepareForDragOperation(_ sender: NSDraggingInfo) -> Bool {
        Self.droppedURL(from: sender) != nil || super.prepareForDragOperation(sender)
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        if let url = Self.droppedURL(from: sender) {
            onDropURL?(url)
            return true
        }
        return super.performDragOperation(sender)
    }
}
