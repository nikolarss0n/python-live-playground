import AppKit
import PlaygroundCore

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var controller: PlaygroundWindowController?
    private var pendingOpen: [URL] = []
    let recent = RecentFiles()

    func applicationDidFinishLaunching(_ notification: Notification) {
        let selfTest = CommandLine.arguments.contains("--self-test")
        let controller = PlaygroundWindowController(webRoot: Self.webRoot(), recent: recent)
        self.controller = controller
        NSApp.mainMenu = MainMenu.build(appDelegate: self, controller: controller)
        controller.showWindow(nil)
        NSApp.activate()
        if selfTest {
            Task { await SelfTest(controller: controller).runAndExit() }
        } else {
            controller.loadApp()
            pendingOpen.forEach(controller.open)
            pendingOpen = []
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    /// A `.py` file opened from Finder or dropped on the Dock icon.
    func application(_ application: NSApplication, open urls: [URL]) {
        guard let controller else { pendingOpen += urls; return }
        urls.forEach(controller.open)
    }

    // MARK: Open Recent

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        let urls = recent.urls()
        for (index, url) in urls.enumerated() {
            let item = NSMenuItem(title: url.lastPathComponent, action: #selector(openRecent(_:)), keyEquivalent: "")
            item.target = self
            item.tag = index
            item.toolTip = url.path
            item.representedObject = url
            menu.addItem(item)
        }
        if !urls.isEmpty { menu.addItem(.separator()) }
        let clear = NSMenuItem(title: "Clear Menu", action: urls.isEmpty ? nil : #selector(clearRecent(_:)), keyEquivalent: "")
        clear.target = self
        menu.addItem(clear)
    }

    @objc private func openRecent(_ sender: NSMenuItem) {
        guard let url = sender.representedObject as? URL else { return }
        controller?.open(url)
    }

    @objc private func clearRecent(_ sender: NSMenuItem) {
        recent.clear()
    }

    /// The `.app` carries the web build in Resources/web. `PLAYGROUND_WEB_DIR` points a bare binary at a local build.
    private static func webRoot() -> URL {
        if let override = ProcessInfo.processInfo.environment["PLAYGROUND_WEB_DIR"] {
            return URL(filePath: override)
        }
        return Bundle.main.resourceURL!.appending(path: "web")
    }
}
