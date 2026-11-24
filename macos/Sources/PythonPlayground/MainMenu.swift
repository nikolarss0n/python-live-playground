import AppKit
import PlaygroundCore

/// The menu bar. File and Run commands go to the window controller through the responder chain; Edit uses the
/// standard selectors so copy, paste and undo work inside the web view.
@MainActor
enum MainMenu {
    static let appName = Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? "py"

    static func build(appDelegate: AppDelegate, controller: PlaygroundWindowController) -> NSMenu {
        let main = NSMenu()
        main.addItem(submenu(appName, [
            item("About \(appName)", #selector(NSApplication.orderFrontStandardAboutPanel(_:))),
            .separator(),
            item("Hide \(appName)", #selector(NSApplication.hide(_:)), "h"),
            item("Hide Others", #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option]),
            item("Show All", #selector(NSApplication.unhideAllApplications(_:))),
            .separator(),
            item("Quit \(appName)", #selector(NSApplication.terminate(_:)), "q"),
        ]))

        let recentMenu = NSMenu(title: "Open Recent")
        recentMenu.delegate = appDelegate
        let recentItem = NSMenuItem(title: "Open Recent", action: nil, keyEquivalent: "")
        recentItem.submenu = recentMenu
        main.addItem(submenu("File", [
            item("Open…", #selector(PlaygroundWindowController.openDocument(_:)), "o"),
            item("Open Folder…", #selector(PlaygroundWindowController.openFolderDialog(_:)), "o", [.command, .shift]),
            recentItem,
            .separator(),
            item("Reload from Disk", #selector(PlaygroundWindowController.reloadFromDisk(_:)), "r", [.command, .shift]),
            .separator(),
            item("Close", #selector(NSWindow.performClose(_:)), "w"),
            item("Save", #selector(PlaygroundWindowController.saveDocument(_:)), "s"),
            item("Save As…", #selector(PlaygroundWindowController.saveDocumentAs(_:)), "s", [.command, .shift]),
        ]))

        main.addItem(submenu("Edit", [
            item("Undo", Selector(("undo:")), "z"),
            item("Redo", Selector(("redo:")), "z", [.command, .shift]),
            .separator(),
            item("Cut", #selector(NSText.cut(_:)), "x"),
            item("Copy", #selector(NSText.copy(_:)), "c"),
            item("Paste", #selector(NSText.paste(_:)), "v"),
            item("Select All", #selector(NSText.selectAll(_:)), "a"),
        ]))

        main.addItem(submenu("Run", [
            item("Run", #selector(PlaygroundWindowController.runCode(_:)), "\r"),
            item("Stop", #selector(PlaygroundWindowController.stopCode(_:)), "."),
        ]))

        main.addItem(submenu("View", [
            item("Reload", #selector(PlaygroundWindowController.reloadPage(_:)), "r"),
            .separator(),
            transparencyItem(controller: controller),
            .separator(),
            item("Enter Full Screen", #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control]),
        ]))

        let windowMenu = submenu("Window", [
            item("Minimize", #selector(NSWindow.performMiniaturize(_:)), "m"),
            item("Zoom", #selector(NSWindow.performZoom(_:))),
        ])
        NSApp.windowsMenu = windowMenu.submenu
        main.addItem(windowMenu)
        return main
    }

    /// int-ai-m's Background Transparency row: a label, the live percentage and a slider, inside the View menu.
    private static func transparencyItem(controller: PlaygroundWindowController) -> NSMenuItem {
        let row = NSView(frame: NSRect(x: 0, y: 0, width: 260, height: 54))
        let title = NSTextField(labelWithString: "Background Transparency")
        title.font = .menuFont(ofSize: 12)
        title.textColor = .secondaryLabelColor
        title.frame = NSRect(x: 20, y: 32, width: 170, height: 16)
        row.addSubview(title)

        let value = NSTextField(labelWithString: Glass.percent(controller.transparency))
        value.font = .monospacedDigitSystemFont(ofSize: 12, weight: .medium)
        value.textColor = .secondaryLabelColor
        value.alignment = .right
        value.frame = NSRect(x: 190, y: 32, width: 54, height: 16)
        row.addSubview(value)

        let slider = TransparencySlider(value: controller.transparency, minValue: 0, maxValue: 1, target: nil, action: nil)
        slider.isContinuous = true
        slider.frame = NSRect(x: 18, y: 6, width: 228, height: 22)
        slider.toolTip = "Changes only the background. Text and code stay fully visible."
        slider.setAccessibilityLabel("Background transparency")
        slider.onChange = { [weak controller, weak value] transparency in
            controller?.transparency = transparency
            value?.stringValue = Glass.percent(transparency)
        }
        row.addSubview(slider)

        let item = NSMenuItem()
        item.view = row
        return item
    }

    private static func submenu(_ title: String, _ items: [NSMenuItem]) -> NSMenuItem {
        let menu = NSMenu(title: title)
        items.forEach(menu.addItem)
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        item.submenu = menu
        return item
    }

    private static func item(_ title: String, _ action: Selector?, _ key: String = "", _ modifiers: NSEvent.ModifierFlags = .command) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.keyEquivalentModifierMask = key.isEmpty ? [] : modifiers
        return item
    }
}

/// A slider that reports each move through a closure, so the menu row needs no target object.
final class TransparencySlider: NSSlider {
    var onChange: ((Double) -> Void)?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        target = self
        action = #selector(changed)
    }

    required init?(coder: NSCoder) { nil }

    convenience init(value: Double, minValue: Double, maxValue: Double, target: AnyObject?, action: Selector?) {
        self.init(frame: .zero)
        self.minValue = minValue
        self.maxValue = maxValue
        doubleValue = value
    }

    @objc private func changed() {
        onChange?(doubleValue)
    }
}
