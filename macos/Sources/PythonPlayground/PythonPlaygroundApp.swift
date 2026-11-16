import AppKit
import SwiftUI

@main
struct PythonPlaygroundApp: App {
    @NSApplicationDelegateAdaptor private var delegate: AppDelegate
    @State private var page: PlaygroundPage

    init() {
        let selfTest = CommandLine.arguments.contains("--self-test")
        let page = PlaygroundPage(webRoot: Self.webRoot(), blockNetwork: selfTest)
        _page = State(initialValue: page)
        if selfTest {
            Task { @MainActor in await SelfTest(page: page).runAndExit() }
        } else {
            page.load()
        }
    }

    var body: some Scene {
        WindowGroup {
            PlaygroundWebView(page: page)
                .frame(minWidth: 900, minHeight: 600)
                .ignoresSafeArea()
        }
        .defaultSize(width: 1440, height: 900)
    }

    /// The `.app` carries the web build in Resources/web. `PLAYGROUND_WEB_DIR` points a `swift run` at a local build.
    private static func webRoot() -> URL {
        if let override = ProcessInfo.processInfo.environment["PLAYGROUND_WEB_DIR"] {
            return URL(filePath: override)
        }
        return Bundle.main.resourceURL!.appending(path: "web")
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
