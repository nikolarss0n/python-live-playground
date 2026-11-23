import AppKit

/// When the process started its own code, for the self-test's launch timings.
let launchedAt = Date()

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
